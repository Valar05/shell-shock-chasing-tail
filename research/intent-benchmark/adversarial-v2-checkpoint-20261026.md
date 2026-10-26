# Adversarial training checkpoint — 2026-10-26

## Verified experiment
- Source branch: `campaign/intent-adversarial-v2-20261026`
- Training source SHA: `ea3f0de61c24b7899928c1554f526d1318871ea0`
- Computer Hands request: `shellshock-adversarial-v2-cauldron-20261026`; completed exit 0 on THECAULDRON, Python 3.10.11.
- 132 training examples, **17/23 correct held-out/adversarial classifications**, **2 critical misclassifications**, model JSON **44,329 bytes**, SHA-256 `e4dafc3353d00a9be72b05552d60623bb1938e931ee27da744bf894982351a6a`.
- No dependencies, model downloads or GPU. Free space reported on checked volume ~65.9 GB.
- Output lives at `%LOCALAPPDATA%\\RitsuCampaigns\\shellshock-intent-v2` with `model.json`, `evaluation.json`, `receipt.json`.

## Research and limits
A small linear classifier with sparse character n-grams and word features is appropriate to investigate: <https://scikit-learn.org/stable/modules/generated/sklearn.feature_extraction.text.HashingVectorizer.html> and peer-reviewed intent-classification studies compare SVM and Naive Bayes. This implementation uses a Python standard-library averaged multiclass perceptron, not scikit-learn, ONNX, or an LLM.

The previous naive Bayes model achieved 1/9 on a **different** held-out set; these numbers are not a head-to-head comparison. V2's 17/23 (73.9%) is preliminary and **failed its critical-safety criterion**. Do not put its output in charge of motion, fire, orientation, negation or numeric slots. Prediction is advisory only. The model remains a small experimental JSON; no gameplay or Android recognition integration.

## Next gate
1. Inspect the exact two critical misclassified rows from `evaluation.json` and add broader adverse examples with semantic distinctions.
2. Run deterministic baseline, hybrid and learned model against **the same untouched evaluation corpus**, recording both intent classification and executable-action false positives.
3. Separate train and test by phrase family and protect numbers/directions/negation with hard typed extraction.
4. Trial real Android ASR partial-result cadence and echo conditions only after the parser safety proof.
