package com.nutriofuel.app;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Enable edge-to-edge so env(safe-area-inset-bottom) works in the WebView
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    }
}
