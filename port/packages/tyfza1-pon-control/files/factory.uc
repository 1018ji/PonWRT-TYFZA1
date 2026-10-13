#!/usr/bin/ucode
// SPDX-License-Identifier: GPL-2.0-or-later
'use strict';
import { readfile, writefile, mkdir, chmod } from 'fs';

const source = ARGV[0];
const output = ARGV[1];
const hs = readfile(source + '/config_hs.xml');
const cs = readfile(source + '/config.xml');

function field(text, key) {
	const entry = match(text, regexp('<Value\\s+Name="' + key + '"\\s+Value="([^"]*)"'));
	if (!entry) die('Missing factory field: ' + key);
	return replace(entry[1], /&(quot|apos|lt|gt|amp);/g,
		(m, entity) => ({ quot: '"', apos: "'", lt: '<', gt: '>', amp: '&' })[entity]);
}

function save(path, data) {
	const full = output + '/' + path;
	let directory = '';
	const parts = split(full, '/');
	pop(parts);
	for (let part in parts) {
		directory += part + '/';
		mkdir(directory);
	}
	if (writefile(full, data) != length(data)) die('Cannot write factory runtime: ' + path);
}

function hexbytes(text) {
	return join('', map(split(text, ','), value => chr(int(value, 16))));
}

function mac(text) {
	if (!match(text, /^[0-9a-fA-F]{12}$/) || (int(substr(text, 0, 2), 16) & 1) || text == '000000000000')
		die('Invalid factory MAC');
	return join(':', map(match(text, /../g), entry => entry[0]));
}

let calibration = readfile(source + '/rtkbosa_k.bin');
if (length(calibration) != 1024) die('Factory BOSA calibration must be 1024 bytes');
save('lib/firmware/realtek/rtl9617c/bosa-calibration.bin', calibration);

for (let radio in [ ['rtl8852ce', 0], ['rtl8192xbe', 1] ]) {
	let data = 'TYFC0003';
	for (let key in ['HW_RX_GAINGAP_2G_CCK_AB', 'HW_RX_GAINGAP_2G_OFDM_AB',
		'HW_RX_GAINGAP_5GL_AB', 'HW_RX_GAINGAP_5GM_AB', 'HW_RX_GAINGAP_5GH_AB'])
		data += chr(int(field(hs, key)));
	for (let path in ['A', 'B']) data += chr(int(field(hs, 'HW_THERMAL_' + path + '_WLAN' + radio[1])));
	data += chr(int(field(hs, 'HW_XCAP_WLAN' + radio[1] + '_AX')));
	for (let band in ['2G_CCK', '2G_BW40_1S', '5G_BW40_1S'])
		for (let path in ['A', 'B']) data += hexbytes(field(hs, 'HW_' + band + '_TSSI_' + path));
	const address = mac(field(hs, 'WLAN_MAC_ADDR'));
	data += hexbytes(replace(address, /:/g, ','));
	for (let kind in ['GAIN', 'CW']) {
		for (let path in ['A', 'B']) data += hexbytes(field(hs, 'HW_2G_CCK_TSSI_' + kind + '_DIFF_' + path));
		for (let path in ['A', 'B'])
			for (let band in ['2G', '5G']) data += hexbytes(field(hs, 'HW_' + band + '_TSSI_' + kind + '_DIFF_' + path));
	}
	// The stock flash API has no BW20/80/160 entries: B retains A's last CW byte.
	const slope = split(field(hs, 'HW_5G_TSSI_CW_DIFF_A'), ',');
	for (let seed in [0, int(slope[length(slope) - 1], 16)])
		for (let width = 0; width < 4; width++)
			for (let i = 0; i < 14; i++) data += chr(width == 1 ? 0 : seed);
	if (length(data) != 284) die('Invalid factory radio calibration size');
	save('lib/firmware/realtek/tyfza1/' + radio[0] + '/flash-calibration.bin', data);
}

const start = index(cs, '<chain chainName="EPON_LLID_TBL">');
if (start < 0) die('Missing factory EPON LLID identity');
const remainder = substr(cs, start);
const llid = substr(remainder, 0, index(remainder, '</chain>'));
const identity = {
	onu_mac: mac(field(llid, 'macAddr')),
	serial_number: field(hs, 'GPON_SN'),
	vendor_id: field(hs, 'PON_VENDOR_ID'),
	oam_model: field(hs, 'EPON_ONU_MODEL')
};
let config = "config pon 'pon'\n";
for (let key, value in identity)
	config += sprintf("\toption %s '%s'\n", key, replace(value, /'/g, "'\\''"));
save('var/run/tyfza1-factory/pon_factory', config);
chmod(output + '/var/run/tyfza1-factory', 0700);
chmod(output + '/var/run/tyfza1-factory/pon_factory', 0600);
print('Loaded this device\'s factory PON identity and optical/radio calibration\n');
