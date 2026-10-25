package org.shellshock.asrlab

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.os.SystemClock
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer

/** No Godot imports. Can be wrapped by a Godot v2 Android plugin without changing this class. */
data class RecognitionEvent(
    val engine: String,
    val transcript: String,
    val confidence: Float?,
    val elapsedMs: Long,
    val error: String? = null
)

class RecognitionPort(private val context: Context, private val emit: (RecognitionEvent) -> Unit) {
    private var recognizer: SpeechRecognizer? = null
    private var startAt: Long = 0L
    private var completed = false
    private var engine = "android-system"
    val onDeviceAvailable: Boolean
        get() = android.os.Build.VERSION.SDK_INT >= 31 && SpeechRecognizer.isOnDeviceRecognitionAvailable(context)

    fun start(preferOnDevice: Boolean) {
        require(android.os.Looper.myLooper() == android.os.Looper.getMainLooper()) { "Call on main thread" }
        close()
        completed = false
        startAt = SystemClock.elapsedRealtime()
        engine = if (preferOnDevice) "android-on-device" else "android-system"
        if (!SpeechRecognizer.isRecognitionAvailable(context)) {
            finish("", null, "recognition_unavailable")
            return
        }
        if (preferOnDevice && !onDeviceAvailable) {
            finish("", null, "on_device_unavailable")
            return
        }
        try {
            recognizer = if (preferOnDevice) SpeechRecognizer.createOnDeviceSpeechRecognizer(context)
                else SpeechRecognizer.createSpeechRecognizer(context)
            recognizer!!.setRecognitionListener(object : RecognitionListener {
                override fun onReadyForSpeech(params: Bundle?) {}
                override fun onBeginningOfSpeech() {}
                override fun onRmsChanged(rmsdB: Float) {}
                override fun onBufferReceived(buffer: ByteArray?) {}
                override fun onEndOfSpeech() {}
                override fun onPartialResults(partialResults: Bundle?) {}
                override fun onEvent(eventType: Int, params: Bundle?) {}
                override fun onError(error: Int) { finish("", null, "android_error_$error") }
                override fun onResults(results: Bundle) {
                    val text = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull().orEmpty()
                    val confidence = results.getFloatArray(SpeechRecognizer.CONFIDENCE_SCORES)?.firstOrNull()
                    finish(text, confidence, if (text.isBlank()) "empty" else null)
                }
            })
            val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en-US")
                putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false)
                putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
            }
            recognizer!!.startListening(intent)
        } catch (e: Exception) { finish("", null, e.javaClass.simpleName + ":" + e.message) }
    }

    private fun finish(text: String, confidence: Float?, error: String?) {
        if (completed) return
        completed = true
        emit(RecognitionEvent(engine, text, confidence, SystemClock.elapsedRealtime() - startAt, error))
    }
    fun close() { recognizer?.cancel(); recognizer?.destroy(); recognizer = null }
}
