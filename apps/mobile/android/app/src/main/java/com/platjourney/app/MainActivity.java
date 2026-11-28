package com.platjourney.app;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.WebView;
import android.widget.Toast;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

/** The app's web view, with the loading screen drawn natively from the first frame (BootCoverView)
 * until the page's own copy is on screen. */
public class MainActivity extends BridgeActivity {

    private BootCoverView bootCover;
    private final Handler main = new Handler(Looper.getMainLooper());
    // When back last reached the first screen: a second press within this long leaves the app.
    private long lastBack;
    private static final long EXIT_WINDOW_MS = 2_000;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BootCoverPlugin.class);
        registerPlugin(AppSharePlugin.class);
        super.onCreate(savedInstanceState);
        showBootCover();
        confirmExitOnBack();
    }

    /** Back goes back through the app's screens; on the first one it asks for a second press
     * before leaving, so a stray press does not close the app. */
    private void confirmExitOnBack() {
        getOnBackPressedDispatcher()
            .addCallback(
                this,
                new OnBackPressedCallback(true) {
                    @Override
                    public void handleOnBackPressed() {
                        WebView web = getBridge() != null ? getBridge().getWebView() : null;
                        if (web != null && web.canGoBack()) {
                            web.goBack();
                            return;
                        }
                        long now = SystemClock.uptimeMillis();
                        if (now - lastBack < EXIT_WINDOW_MS) {
                            finish();
                            return;
                        }
                        lastBack = now;
                        Toast.makeText(MainActivity.this, R.string.press_back_again, Toast.LENGTH_SHORT).show();
                    }
                }
            );
    }

    /** The page hides it once its copy is on screen; a page that does not say so (an older
     * release) lets go once the web view finishes loading, and none keeps it past 12 seconds. */
    private void showBootCover() {
        bootCover = new BootCoverView(this, BootCoverPlugin.rememberedBuddy(this));
        addContentView(
            bootCover,
            new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        );
        if (getBridge() != null) {
            getBridge()
                .addWebViewListener(
                    new WebViewListener() {
                        @Override
                        public void onPageLoaded(WebView webView) {
                            main.postDelayed(MainActivity.this::hideBootCover, 600);
                        }
                    }
                );
        }
        main.postDelayed(this::hideBootCover, 12_000);
    }

    /** The web view keeps cookies in memory and writes them to disk only now and then: an app
     * swiped away before that loses the sign-in. Leaving the screen writes them first. */
    @Override
    public void onPause() {
        super.onPause();
        CookieManager.getInstance().flush();
    }

    void hideBootCover() {
        final BootCoverView cover = bootCover;
        if (cover == null) return;
        bootCover = null;
        cover
            .animate()
            .alpha(0f)
            .setDuration(200)
            .withEndAction(() -> {
                cover.stop();
                if (cover.getParent() instanceof ViewGroup) ((ViewGroup) cover.getParent()).removeView(cover);
            })
            .start();
    }
}
