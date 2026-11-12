# WebKitGTK 2.54 fade workaround

The Linux shell selects TextureMapper and disables partial compositing only on
WebKitGTK 2.54 when `WEBKIT_USE_SKIA_FOR_COMPOSITION` is not explicitly set.
Feature functions are dynamically resolved from the linked WebKit library;
missing symbols leave defaults alone. Other platforms and WebKit series keep
their defaults. A one-shot termination callback recreates the initial web
process after settings change. This startup behaviour needs native validation.

## Standalone reproduction

Prerequisites: Linux, GTK3, WebKitGTK 4.1 API, Python PyGObject and a visible X11
session. No frontend compilation, npm installation or TagRex library is used.
Run these separately, keeping the small probe window visible and unobscured:

```
GDK_BACKEND=x11 python tests/native/compositor.py --compositor system
GDK_BACKEND=x11 python tests/native/compositor.py --compositor compatible
```

The probe samples GDK presentation pixels rather than reading CSS opacity. It
runs six open/close cycles and reports calibration and large reverse colour
steps. A useful result requires calibration in both modes; compare reversal
counts and visible flashes. Exit 0 means calibrated with no detected reversal,
1 indicates a failed comparison, and 2 means no completed result (for example a
missing display or timeout). It is a synthetic fade probe, not a claim that all
artwork transitions are covered.

Affected runtime observed in the original local investigation: WebKitGTK
2.54.1. The new standalone reproduction has only been syntax checked during
this split; its native before/after result remains to be confirmed on affected
hardware. The PR stays a draft until that evidence is available. Original
related upstream report: https://github.com/SimoHypers/limusic/issues/433.

Also test the debug app starts exactly once without a blank window on 2.54,
that an explicit environment override bypasses the workaround, and that older
and newer WebKit versions retain their startup behaviour.
