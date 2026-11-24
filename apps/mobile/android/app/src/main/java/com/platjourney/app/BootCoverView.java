package com.platjourney.app;

import android.animation.ArgbEvaluator;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RadialGradient;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.os.SystemClock;
import android.provider.Settings;
import android.view.View;
import java.util.Locale;

/** A native copy of the web app's boot screen (components/boot-screen.css): the name on top, the
 * buddy floating with the controller's four buttons pressed in turn around it, the bar running
 * through the trophy tiers and the first line. Drawn from the first frame, before the page loads. */
public class BootCoverView extends View {

    // The default look's tokens (styles/theme.css).
    private static final int BACKGROUND = 0xff08130f;
    private static final int ACCENT = 0xffc2f366;
    private static final int BORDER = 0xff1d392d;
    private static final int SUBTLE = 0xff8aa99a;
    private static final int FOREGROUND = 0xfff4fbf6;
    private static final int[] TIERS = { 0xffca9774, 0xffc3ced6, 0xffe6c47e, 0xffbad2e4 };

    private final float dp;
    private final boolean still;
    private final boolean object;
    private final long start = SystemClock.uptimeMillis();
    private final ArgbEvaluator argb = new ArgbEvaluator();
    private final Bitmap buddy;
    private final Bitmap logo;
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint stroke = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint text = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Path[] symbols = new Path[4];
    private final String line;
    private boolean running = true;

    static int buddyPicture(Context context, String buddy) {
        return context.getResources().getIdentifier("buddy_" + buddy, "drawable", context.getPackageName());
    }

    public BootCoverView(Context context, String buddyName) {
        super(context);
        dp = getResources().getDisplayMetrics().density;
        still = Settings.Global.getFloat(context.getContentResolver(), Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f;
        int picture = buddyPicture(context, buddyName);
        object = picture != 0 && !"nexo".equals(buddyName);
        buddy = BitmapFactory.decodeResource(getResources(), picture != 0 ? picture : buddyPicture(context, "nexo"));
        logo = BitmapFactory.decodeResource(getResources(), R.drawable.boot_logo);
        line = Locale.getDefault().getLanguage().equals("en") ? "TURNING ON THE CONTROLLER" : "LIGANDO O CONTROLE";
        stroke.setStyle(Paint.Style.STROKE);
        stroke.setStrokeCap(Paint.Cap.ROUND);
        stroke.setStrokeJoin(Paint.Join.ROUND);
        for (int i = 0; i < 4; i++) symbols[i] = symbol(i);
        setClickable(true);
    }

    /** △ ○ × □ in the page's 20-unit drawing, at 18 points. */
    private Path symbol(int index) {
        Path p = new Path();
        switch (index) {
            case 0:
                p.moveTo(10, 3);
                p.lineTo(17.5f, 16);
                p.lineTo(2.5f, 16);
                p.close();
                break;
            case 1:
                p.addCircle(10, 10, 7, Path.Direction.CW);
                break;
            case 2:
                p.moveTo(4, 4);
                p.lineTo(16, 16);
                p.moveTo(16, 4);
                p.lineTo(4, 16);
                break;
            default:
                p.addRoundRect(new RectF(3.5f, 3.5f, 16.5f, 16.5f), 1, 1, Path.Direction.CW);
        }
        return p;
    }

    void stop() {
        running = false;
    }

    private static float ease(float t) {
        return t < 0.5f ? 2 * t * t : 1 - (float) Math.pow(-2 * t + 2, 2) / 2;
    }

    @Override
    protected void onDraw(Canvas canvas) {
        float t = still ? 0 : (SystemClock.uptimeMillis() - start) / 1000f;
        float w = getWidth();
        float h = getHeight();
        float cx = w / 2;
        canvas.drawColor(BACKGROUND);

        // The accent's wash behind the stage.
        paint.setShader(new RadialGradient(cx, h / 2, 300 * dp, 0x14c2f366, 0x00c2f366, Shader.TileMode.CLAMP));
        canvas.drawRect(0, 0, w, h, paint);
        paint.setShader(null);

        // The page's column, centred: the stage, 26, the bar, 26, the line.
        text.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.NORMAL));
        text.setTextSize(11 * dp);
        text.setLetterSpacing(0.14f);
        float lineHeight = 11 * dp;
        float total = (200 + 26 + 4 + 26) * dp + lineHeight;
        float top = (h - total) / 2;
        float stageX = cx - 100 * dp;

        // The name on top.
        Paint.FontMetrics fm;
        text.setLetterSpacing(0);
        text.setTextSize(20 * dp);
        text.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
        float plat = text.measureText("plat");
        float brandWidth = 28 * dp + 10 * dp + plat + text.measureText("journey");
        float bx = cx - brandWidth / 2;
        float by = 40 * dp;
        canvas.drawBitmap(logo, null, new RectF(bx, by, bx + 28 * dp, by + 28 * dp), paint);
        fm = text.getFontMetrics();
        float baseline = by + 14 * dp - (fm.ascent + fm.descent) / 2;
        text.setColor(FOREGROUND);
        canvas.drawText("plat", bx + 38 * dp, baseline, text);
        text.setColor(ACCENT);
        canvas.drawText("journey", bx + 38 * dp + plat, baseline, text);

        // The buddy, floating (and breathing, if it is an object).
        float lift = (float) (-6 * dp * (0.5 - 0.5 * Math.cos(t / 3f * 2 * Math.PI)));
        float squash = object ? (float) (1 - 0.02 * (0.5 - 0.5 * Math.cos(t / 2.5f * 2 * Math.PI))) : 1;
        float size = 108 * dp;
        float bcx = stageX + 100 * dp;
        float bottom = top + 100 * dp + size / 2 + lift;
        canvas.drawBitmap(buddy, null, new RectF(bcx - size / 2, bottom - size * squash, bcx + size / 2, bottom), paint);

        // The four buttons, each pressed a quarter of the cycle after the one before.
        float[][] spots = { { 100, 19 }, { 181, 100 }, { 100, 181 }, { 19, 100 } };
        for (int i = 0; i < 4; i++) {
            float p = still ? 0.5f : (((t - i * 0.4f) % 1.6f) + 1.6f) % 1.6f / 1.6f;
            float lit = p < 0.1f ? p / 0.1f : p < 0.3f ? 1 - (p - 0.1f) / 0.2f : 0;
            float scale = 1 - 0.12f * lit;
            float kx = stageX + spots[i][0] * dp;
            float ky = top + spots[i][1] * dp;
            canvas.save();
            canvas.scale(scale, scale, kx, ky);
            stroke.setStrokeWidth(1.5f * dp);
            stroke.setColor((int) argb.evaluate(lit, BORDER, ACCENT));
            canvas.drawCircle(kx, ky, 18.25f * dp, stroke);
            canvas.translate(kx - 9 * dp, ky - 9 * dp);
            canvas.scale(0.9f * dp, 0.9f * dp);
            stroke.setStrokeWidth(2);
            stroke.setColor((int) argb.evaluate(lit, SUBTLE, ACCENT));
            canvas.drawPath(symbols[i], stroke);
            canvas.restore();
        }

        // The bar running through the tiers.
        float barTop = top + 226 * dp;
        RectF bar = new RectF(cx - 60 * dp, barTop, cx + 60 * dp, barTop + 4 * dp);
        paint.setColor(BORDER);
        canvas.drawRoundRect(bar, 2 * dp, 2 * dp, paint);
        float run = still ? 0.5f : ease((t % 1.6f) / 1.6f);
        float fx = bar.left + (-48 + run * 168) * dp;
        canvas.save();
        canvas.clipRect(bar);
        paint.setShader(new LinearGradient(fx, 0, fx + 48 * dp, 0, TIERS, null, Shader.TileMode.CLAMP));
        canvas.drawRoundRect(new RectF(fx, bar.top, fx + 48 * dp, bar.bottom), 2 * dp, 2 * dp, paint);
        paint.setShader(null);
        canvas.restore();

        // The first line.
        text.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.NORMAL));
        text.setTextSize(11 * dp);
        text.setLetterSpacing(0.14f);
        text.setColor(SUBTLE);
        float lw = text.measureText(line);
        fm = text.getFontMetrics();
        canvas.drawText(line, cx - lw / 2, barTop + 30 * dp - fm.ascent, text);

        if (running && !still) postInvalidateOnAnimation();
    }
}
