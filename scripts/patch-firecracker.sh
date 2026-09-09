#!/usr/bin/env bash
set -euo pipefail

FC_DIR="${1:-$(cd "$(dirname "$0")/.." && pwd)/firecracker}"

if [ ! -d "$FC_DIR/src/vmm" ]; then
  echo "patch-firecracker: missing vmm sources at $FC_DIR" >&2
  exit 1
fi

echo "Patching Firecracker EventSet compatibility in $FC_DIR..."

find "$FC_DIR/src/vmm" -name '*.rs' ! -path '*/vsock/unix/muxer.rs' -print0 \
  | xargs -0 sed -i 's|utils::epoll::EventSet|event_manager::EventSet|g'

python3 - "$FC_DIR/src/vmm/src/devices/virtio/vsock/unix/muxer.rs" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text()

old_import = "use utils::epoll::{ControlOperation, Epoll, EpollEvent, EventSet};"
new_import = """use utils::epoll::{ControlOperation, Epoll, EpollEvent, EventSet as UtilsEventSet};
use event_manager::EventSet;"""
if old_import in text:
    text = text.replace(old_import, new_import)
elif "UtilsEventSet" not in text:
    text = text.replace(
        "use utils::epoll::{ControlOperation, Epoll, EpollEvent};",
        new_import,
    )

helper = """
fn utils_event_set(set: EventSet) -> UtilsEventSet {
    UtilsEventSet::from_bits(set.bits()).expect("valid epoll event set")
}

fn manager_event_set(set: UtilsEventSet) -> EventSet {
    EventSet::from_bits(set.bits()).expect("valid epoll event set")
}
"""
if "fn utils_event_set" not in text:
    text = text.replace(
        "/// An epoll listener, registered under the muxer's nested epoll FD.",
        helper + "\n/// An epoll listener, registered under the muxer's nested epoll FD.",
        1,
    )

replacements = [
    ("Connection { key: ConnMapKey, evset: EventSet }", "Connection { key: ConnMapKey, evset: UtilsEventSet }"),
    ("fn handle_event(&mut self, fd: RawFd, event_set: EventSet)", "fn handle_event(&mut self, fd: RawFd, event_set: UtilsEventSet)"),
    ("conn.notify(event_set);", "conn.notify(manager_event_set(event_set));"),
    ("UtilsUtilsEventSet::from_bits(ev.events).unwrap()", "UtilsEventSet::from_bits(ev.events).unwrap()"),
    ("EpollEvent::new(EventSet::empty(), 0)", "EpollEvent::new(UtilsEventSet::empty(), 0)"),
    ("evset: conn.get_polled_evset()", "evset: utils_event_set(conn.get_polled_evset())"),
    ("EpollListener::LocalStream(_) => EventSet::IN", "EpollListener::LocalStream(_) => UtilsEventSet::IN"),
    ("EpollListener::HostSock => EventSet::IN", "EpollListener::HostSock => UtilsEventSet::IN"),
    ("let new_evset = conn.get_polled_evset();", "let new_evset = utils_event_set(conn.get_polled_evset());"),
]
for old, new in replacements:
    text = text.replace(old, new)

path.write_text(text)
PY

echo "Firecracker patch applied."
