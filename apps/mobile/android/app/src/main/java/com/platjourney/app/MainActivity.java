package com.platjourney.app;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.ViewGroup;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

/** The app's web view, with the loading screen drawn natively from the first frame (BootCoverView)
 * until the page's own copy is on screen. */
public class MainActivity extends BridgeActivity {

    private BootCoverView bootCover;
    private final Handler main = new Handler(Looper.getMainLooper());

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BootCoverPlugin.class);
        super.onCreate(savedInstanceState);
        showBootCover();
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
