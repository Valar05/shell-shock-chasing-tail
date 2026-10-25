package org.shellshock.asrlab

import android.Manifest
import android.app.Activity
import android.content.pm.PackageManager
import android.os.Bundle
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import org.json.JSONObject

/** Experimental native microphone benchmark. No hidden audio injection, no claim of identical-PCM A/B. */
class MainActivity : Activity() {
    private lateinit var port: RecognitionPort
    private lateinit var display: TextView
    private val rows = mutableListOf<JSONObject>()
    private var label = "unspecified"
    override fun onCreate(state: Bundle?) {
        super.onCreate(state)
        port = RecognitionPort(this) { result ->
            val row = JSONObject().apply {
                put("case", label)
                put("engine", result.engine)
                put("transcript", result.transcript)
                put("elapsedMs", result.elapsedMs)
                put("confidence", result.confidence ?: JSONObject.NULL)
                put("error", result.error ?: JSONObject.NULL)
                put("device", android.os.Build.MODEL)
                put("sdk", android.os.Build.VERSION.SDK_INT)
                put("input", "physical microphone")
            }
            rows.add(row)
            display.text = "Trials: ${rows.size}\n${row.toString(2)}"
        }
        val layout = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(24,24,24,24) }
        display = TextView(this).apply { textSize = 16f; text = "Android SpeechRecognizer lab. Press a command button, then speak exactly the prompt. System vs on-device are separate engines."; }
        layout.addView(display)
        val cases = linkedMapOf(
            "compound" to "Thirty degrees to the left and run over that tree",
            "halt" to "Driver halt",
            "turn" to "Turn right forty degrees",
            "negation" to "Do not fire",
            "target" to "Beta fire on the machine gun"
        )
        for ((id, spoken) in cases) {
            for (offline in listOf(false, true)) {
                val button = Button(this).apply {
                    text = "${if (offline) "On-device" else "System"}: $spoken"
                    setOnClickListener { label = id; listen(offline) }
                }
                layout.addView(button)
            }
        }
        layout.addView(Button(this).apply {
            text = "Share raw benchmark JSON"
            setOnClickListener {
                val json = JSONObject().put("schema", "shellshock.asr.benchmark.v1").put("rows", org.json.JSONArray(rows)).toString(2)
                val intent = android.content.Intent(android.content.Intent.ACTION_SEND).apply {
                    type = "application/json"; putExtra(android.content.Intent.EXTRA_TEXT, json)
                }
                startActivity(android.content.Intent.createChooser(intent, "Save benchmark results"))
            }
        })
        val scroll = ScrollView(this);scroll.addView(layout);setContentView(scroll)
        requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), 777)
    }
    private fun listen(offline: Boolean) {
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            display.text = "Microphone permission required";requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO),777);return
        }
        display.text = "Listening: $label (on-device=$offline) ..."
        port.start(offline)
    }
    override fun onDestroy() { port.close();super.onDestroy() }
}
