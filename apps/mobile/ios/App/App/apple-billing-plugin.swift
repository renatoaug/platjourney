import Capacitor
import StoreKit
import UIKit

/// StoreKit owns the durable pending queue. The server owns entitlements and the credit ledger.
@objc(AppleBillingPlugin)
public class AppleBillingPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AppleBillingPlugin"
    public let jsName = "AppleBilling"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "products", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "unfinished", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restore", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "finish", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "manageSubscriptions", returnType: CAPPluginReturnPromise)
    ]
    private var updatesTask: Task<Void, Never>?
    private var transactions: [String: Transaction] = [:]
    private var purchasing = false

    public override func load() {
        updatesTask = Task { @MainActor [weak self] in
            for await result in Transaction.updates {
                guard !Task.isCancelled else { break }
                // Unverified transactions are never sent to JavaScript or acknowledged.
                if let payload = self?.verifiedPayload(result) {
                    self?.notifyListeners("transactionUpdated", data: payload)
                }
            }
        }
    }

    deinit { updatesTask?.cancel() }

    @MainActor private func verifiedPayload(_ result: VerificationResult<Transaction>) -> JSObject? {
        guard case .verified(let transaction) = result else { return nil }
        let id = String(transaction.id)
        transactions[id] = transaction
        return ["transactionId": id, "productId": transaction.productID,
                "signedTransactionInfo": result.jwsRepresentation]
    }

    @objc func products(_ call: CAPPluginCall) {
        guard let ids = call.getArray("productIds", String.self), !ids.isEmpty else {
            call.reject("Product identifiers are required", "INVALID_PRODUCTS"); return
        }
        Task { @MainActor in
            do {
                let products = try await Product.products(for: ids)
                call.resolve(["products": products.map { product -> JSObject in
                    var payload: JSObject = ["productId": product.id, "displayName": product.displayName,
                        "description": product.description, "displayPrice": product.displayPrice,
                        "type": product.type.rawValue]
                    if let period = product.subscription?.subscriptionPeriod {
                        payload["subscriptionPeriod"] = ["value": period.value, "unit": String(describing: period.unit)]
                    }
                    return payload
                }])
            } catch { call.reject("Could not load App Store products", "PRODUCTS_FAILED", error) }
        }
    }

    @objc func purchase(_ call: CAPPluginCall) {
        guard let id = call.getString("productId"),
              let token = call.getString("appAccountToken").flatMap(UUID.init(uuidString:)) else {
            call.reject("A product and server-issued account token are required", "INVALID_PURCHASE"); return
        }
        Task { @MainActor in
            guard !purchasing else { call.reject("A purchase is already in progress", "PURCHASE_BUSY"); return }
            purchasing = true
            defer { purchasing = false }
            do {
                guard let product = try await Product.products(for: [id]).first else {
                    call.reject("Product unavailable", "PRODUCT_UNAVAILABLE"); return
                }
                switch try await product.purchase(options: [.appAccountToken(token)]) {
                case .success(let result):
                    guard let payload = verifiedPayload(result) else {
                        call.reject("Transaction could not be verified", "UNVERIFIED_TRANSACTION"); return
                    }
                    call.resolve(["status": "purchased", "transaction": payload])
                case .pending: call.resolve(["status": "pending"])
                case .userCancelled: call.resolve(["status": "cancelled"])
                @unknown default: call.reject("Unknown purchase result", "UNKNOWN_PURCHASE_RESULT")
                }
            } catch { call.reject("Purchase failed", "PURCHASE_FAILED", error) }
        }
    }

    @objc func unfinished(_ call: CAPPluginCall) {
        Task { @MainActor in
            var payloads: [JSObject] = []
            for await result in Transaction.unfinished {
                if let payload = verifiedPayload(result) { payloads.append(payload) }
            }
            call.resolve(["transactions": payloads])
        }
    }

    /// Explicit user action only: sync may show an Apple authentication prompt.
    /// Finished consumables are restored from the server ledger, never currentEntitlements.
    @objc func restore(_ call: CAPPluginCall) {
        Task { @MainActor in
            do {
                try await AppStore.sync()
                var payloads: [String: JSObject] = [:]
                for await result in Transaction.currentEntitlements {
                    if let payload = verifiedPayload(result), let id = payload["transactionId"] as? String {
                        payloads[id] = payload
                    }
                }
                for await result in Transaction.unfinished {
                    if let payload = verifiedPayload(result), let id = payload["transactionId"] as? String {
                        payloads[id] = payload
                    }
                }
                call.resolve(["transactions": Array(payloads.values)])
            } catch { call.reject("Restore failed", "RESTORE_FAILED", error) }
        }
    }

    /// Called by the adapter only after the server durably accepts the signed transaction.
    @objc func finish(_ call: CAPPluginCall) {
        Task { @MainActor in
            guard let id = call.getString("transactionId"), let transaction = transactions[id] else {
                call.reject("Transaction not found", "TRANSACTION_NOT_FOUND"); return
            }
            await transaction.finish()
            transactions.removeValue(forKey: id)
            call.resolve()
        }
    }

    @objc func manageSubscriptions(_ call: CAPPluginCall) {
        Task { @MainActor in
            guard let scene = self.bridge?.viewController?.view.window?.windowScene else {
                call.reject("No active window", "NO_WINDOW"); return
            }
            do {
                try await AppStore.showManageSubscriptions(in: scene)
                call.resolve()
            } catch { call.reject("Could not open subscriptions", "MANAGE_FAILED", error) }
        }
    }
}
