#!/bin/sh
# SPDX-License-Identifier: GPL-2.0-only
REQUIRE_IMAGE_METADATA=1
RAMFS_COPY_BIN='fw_printenv fw_setenv'
RAMFS_COPY_DATA='/etc/fw_env.config'
CI_UBIPART=ubi_device

platform_check_image() {
	nand_do_platform_check "$(board_name)" "$1"
}

# Keep the OEM kernel/root volume IDs required by the signed FIT boot script.
nand_upgrade_prepare_ubi() {
	local ubidev=$(nand_find_ubi "$CI_UBIPART")
	local rootvol=$(nand_find_volume "$ubidev" "$CI_ROOTPART")
	local datavol=$(nand_find_volume "$ubidev" rootfs_data)
	nand_remove_ubiblock "$rootvol" || return 1
	[ -z "$datavol" ] || ubirmvol "/dev/$ubidev" -N rootfs_data || return 1
	ubimkvol "/dev/$ubidev" -n 11 -N rootfs_data -s 16777216
}

platform_do_upgrade() {
	local slot=$(sed -n 's/.*tyfza1.slot=\([01]\).*/\1/p' /proc/cmdline)
	case "$slot" in
		0|1) ;;
		*) echo "UBI sysupgrade requires a persistent TYFZA1 boot" >&2; return 1 ;;
	esac
	CI_KERNPART="ubi_k$slot"
	CI_ROOTPART="ubi_r$slot"
	nand_do_upgrade "$1"
}
