"""
PyRunner preamble — injected at the top of every user script.

This sets up matplotlib for headless rendering and patches plt.show() and
plt.savefig() so that figures are emitted back to the PyRunner console as
inline PNG images via a special marker protocol on stdout.

The marker protocol is:

    \x00PYRUNNER_IMG_BEGIN\x00<len>\x00<base64-png-bytes>\x00PYRUNNER_IMG_END\x00

The runner scans stdout chunks for these markers, extracts the base64 payload,
and emits a separate `image` socket event so the client can render an <img>
inline in the console. Any text between markers (i.e. normal prints) is
forwarded to the client as ordinary stdout.
"""
import builtins
import io as _io
import sys as _sys
import base64 as _b64

# --- 1. Force the Agg (headless) backend BEFORE matplotlib.pyplot is imported ---
import matplotlib as _mpl
_mpl.use("Agg", force=True)
import matplotlib.pyplot as plt  # noqa: E402  (now safe to import pyplot)

# Use a clean default style
try:
    plt.style.use("seaborn-v0_8-whitegrid")
except Exception:
    pass

# Reasonable DPI for inline display (retina-ish)
_DPI = 110


def _emit_fig(fig) -> None:
    """Render a matplotlib Figure to PNG and emit it on stdout."""
    buf = _io.BytesIO()
    fig.savefig(
        buf,
        format="png",
        dpi=_DPI,
        bbox_inches="tight",
        facecolor=fig.get_facecolor(),
    )
    png_bytes = buf.getvalue()
    b64 = _b64.b64encode(png_bytes).decode("ascii")
    marker = f"\x00PYRUNNER_IMG_BEGIN\x00{len(b64)}\x00{b64}\x00PYRUNNER_IMG_END\x00"
    _sys.stdout.write(marker)
    _sys.stdout.flush()


# --- 2. Patch plt.show() to emit all open figures ---
def _patched_show(*args, **kwargs):
    try:
        managers = _mpl._pylab_helpers.Gcf.get_all_fig_managers()
        for mgr in managers:
            fig = mgr.canvas.figure
            _emit_fig(fig)
    except Exception:
        # Fallback: emit every known figure
        for num in plt.get_fignums():
            _emit_fig(plt.figure(num))
    # Close all figures so we don't re-emit them on the next show()
    plt.close("all")


plt.show = _patched_show  # type: ignore[assignment]
builtins.plt = plt  # so user code `import matplotlib.pyplot as plt` still works

# --- 3. Patch plt.savefig() to ALSO emit the image (in addition to writing the file) ---
_orig_savefig = plt.savefig


def _patched_savefig(*args, **kwargs):
    result = _orig_savefig(*args, **kwargs)
    # Emit the current figure inline as well, so users see the image even
    # if they explicitly saved to a file path.
    try:
        fig = plt.gcf()
        _emit_fig(fig)
    except Exception:
        pass
    return result


plt.savefig = _patched_savefig  # type: ignore[assignment]

# Register an atexit hook so any figures left open at exit (i.e. the user
# forgot to call plt.show()) are still emitted automatically.
import atexit as _atexit


def _emit_pending_figs():
    try:
        for num in plt.get_fignums():
            _emit_fig(plt.figure(num))
        plt.close("all")
    except Exception:
        pass


_atexit.register(_emit_pending_figs)
