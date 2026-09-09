#!/usr/bin/env bash
set -euo pipefail

SPAWN_DIR="${1:-$(cd "$(dirname "$0")/.." && pwd)/firecracker-spawn}"
LIB="$SPAWN_DIR/src/lib.rs"

if [ ! -f "$LIB" ]; then
  echo "patch-firecracker-spawn: missing $LIB" >&2
  exit 1
fi

echo "Patching firecracker-spawn for serial-only Firecracker API in $SPAWN_DIR..."

python3 - "$LIB" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text()

replacements = [
    (
        "use vmm::utils::net::mac::MacAddr;",
        "use utils::net::mac::MacAddr;",
    ),
    (
        "use vmm::vmm_config::machine_config::MachineConfig;",
        "use vmm::vmm_config::machine_config::VmConfig;",
    ),
    (
        """        let machine_config = MachineConfig {
            vcpu_count: self.vcpu_count,
            mem_size_mib: self.mem_size_mib,
            smt: false,
            cpu_template: None,
            track_dirty_pages: false,
            huge_pages: if self.use_hugepages {
                HugePageConfig::Hugetlbfs2M
            } else {
                HugePageConfig::None
            },
        };""",
        """        let vm_config = VmConfig {
            vcpu_count: self.vcpu_count,
            mem_size_mib: self.mem_size_mib,
            smt: false,
            cpu_template: None,
            track_dirty_pages: false,
            huge_pages: if self.use_hugepages {
                HugePageConfig::Hugetlbfs2M
            } else {
                HugePageConfig::None
            },
        };""",
    ),
    (
        """            block
                .insert(
                    BlockDeviceConfig {
                        drive_id: "block0".to_string(),
                        partuuid: None,
                        is_root_device: true,
                        cache_type: CacheType::Unsafe,

                        is_read_only: Some(rootfs.read_only),
                        path_on_host: Some(rootfs.path.as_path().display().to_string()),
                        rate_limiter: None,
                        file_engine_type: None,

                        socket: None,
                    },
                    false,
                )
                .unwrap();""",
        """            block
                .insert(BlockDeviceConfig {
                    drive_id: "block0".to_string(),
                    partuuid: None,
                    is_root_device: true,
                    cache_type: CacheType::Unsafe,

                    is_read_only: Some(rootfs.read_only),
                    path_on_host: Some(rootfs.path.as_path().display().to_string()),
                    rate_limiter: None,
                    file_engine_type: None,

                    socket: None,
                })
                .unwrap();""",
    ),
    (
        """            block
                .insert(
                    BlockDeviceConfig {
                        drive_id: format!("block{}", i + 0),
                        partuuid: None,
                        is_root_device: false,
                        cache_type: CacheType::Unsafe,

                        is_read_only: Some(disk.read_only),
                        path_on_host: Some(disk.path.as_path().display().to_string()),
                        rate_limiter: None,
                        file_engine_type: None,

                        socket: None,
                    },
                    false,
                )
                .unwrap();""",
        """            block
                .insert(BlockDeviceConfig {
                    drive_id: format!("block{}", i + 0),
                    partuuid: None,
                    is_root_device: false,
                    cache_type: CacheType::Unsafe,

                    is_read_only: Some(disk.read_only),
                    path_on_host: Some(disk.path.as_path().display().to_string()),
                    rate_limiter: None,
                    file_engine_type: None,

                    socket: None,
                })
                .unwrap();""",
    ),
    (
        """        let vm_resources = VmResources {
            machine_config,
            boot_source,
            net_builder,
            block,
            boot_timer: false,
            vsock,
            pci_enabled: true,
            ..Default::default()
        };""",
        """        let vm_resources = VmResources {
            vm_config,
            boot_source,
            net_builder,
            block,
            boot_timer: false,
            vsock,
            ..Default::default()
        };""",
    ),
    (
        """        let vm = build_microvm_for_boot(
            &instance_info,
            &vm_resources,
            &mut event_manager,
            Some(output),
        )?;""",
        """        let seccomp_filters = vmm::seccomp_filters::get_empty_filters();
        let vm = build_microvm_for_boot(
            &instance_info,
            &vm_resources,
            &mut event_manager,
            &seccomp_filters,
            output,
        )?;""",
    ),
]

for old, new in replacements:
    if old not in text:
        if new.split("\n", 1)[0] in text:
            continue
        raise SystemExit(f"patch-firecracker-spawn: expected snippet not found:\n{old[:120]}...")
    text = text.replace(old, new)

path.write_text(text)
PY

echo "firecracker-spawn patch applied."
