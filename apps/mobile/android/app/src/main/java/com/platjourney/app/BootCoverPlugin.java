package com.platjourney.app;

import android.content.Context;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** What the page tells the app about the loading screen: that its own copy is on screen (`hide`),
 * and which buddy the player picked (`remember`), so the next launch shows it. */
@CapacitorPlugin(name = "BootCover")
public class BootCoverPlugin extends Plugin {

    private static final String PREFS = "platjourney";
    private static final String KEY = "buddy";

    static String rememberedBuddy(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, "nexo");
    }

    @PluginMethod
    public void hide(PluginCall call) {
        getActivity()
            .runOnUiThread(() -> {
                if (getActivity() instanceof MainActivity) ((MainActivity) getActivity()).hideBootCover();
                call.resolve();
            });
    }

    @PluginMethod
    public void remember(PluginCall call) {
        String buddy = call.getString("buddy", "nexo");
        // Only a name the app bundles a picture for: anything else shows Nexo.
        if (BootCoverView.buddyPicture(getContext(), buddy) != 0) {
            getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, buddy).apply();
        }
        call.resolve();
    }
}
