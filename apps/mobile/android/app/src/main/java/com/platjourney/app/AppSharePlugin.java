package com.platjourney.app;

import android.content.Intent;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** The system's share sheet, which the Android web view does not give the page: settings use it to
 * share the app with a friend. */
@CapacitorPlugin(name = "AppShare")
public class AppSharePlugin extends Plugin {

    @PluginMethod
    public void share(PluginCall call) {
        String title = call.getString("title", "");
        String text = call.getString("text", "");
        String url = call.getString("url", "");
        Intent send = new Intent(Intent.ACTION_SEND);
        send.setType("text/plain");
        send.putExtra(Intent.EXTRA_SUBJECT, title);
        send.putExtra(Intent.EXTRA_TEXT, text.isEmpty() ? url : text + " " + url);
        getActivity().runOnUiThread(() -> {
            getActivity().startActivity(Intent.createChooser(send, title));
            call.resolve();
        });
    }
}
