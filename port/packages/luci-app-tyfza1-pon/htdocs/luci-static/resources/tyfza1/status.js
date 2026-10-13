'use strict';
'require baseclass';
'require rpc';
'require network';

var callStatus = rpc.declare({ object: 'luci.tyfza1-pon', method: 'status', expect: { '': {} }, reject: true });
var callInterfaces = rpc.declare({ object: 'network.interface', method: 'dump', reject: true });
var callWireless = rpc.declare({ object: 'luci-rpc', method: 'getWirelessDevices', reject: true });
var modes = {
	epon: 'EPON', 'epon-d10g': '10G EPON（非对称）', 'epon-bi10g': '10G EPON（对称）',
	gpon: 'GPON', xgpon: 'XG-PON', xgspon: 'XGS-PON'
};

function value(v) { return v == null || v === '' ? '—' : String(v); }
function flag(v) { return v === '1' || v === 1 || v === true; }
function badge(text, tone) { return E('span', { class: 'tyf-badge tyf-' + (tone || 'muted') }, text); }
function link(text, path) { return E('a', { href: L.url.apply(L, path.split('/')) }, text); }
function rows(items) {
	return E('dl', { class: 'tyf-facts' }, items.reduce(function(nodes, item) {
		return nodes.concat([E('dt', {}, item[0]), E('dd', {}, item[1] == null ? '—' : item[1])]);
	}, []));
}
function card(title, state, content) {
	return E('section', { class: 'tyf-card' }, [E('div', { class: 'tyf-card-head' }, [E('h3', {}, title), state]), content]);
}
function bytes(v) {
	if (v == null || v === '' || !Number.isFinite(+v) || +v < 0) return '—';
	var n = +v, units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'], i = 0;
	while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
	return n.toFixed(i ? 1 : 0) + ' ' + units[i];
}

function ponState(data) {
	var serdes = data.serdes || {}, mac = data.mac || {}, mpcp = data.mpcp || {};
	if (data.service && data.service.enabled === '0')
		return { text: '未启用', tone: 'muted', help: 'PON 已停用，可在光链路设置中启用。' };
	if (!data.serdes) return { text: '状态不可用', tone: 'muted', help: '未读取到 PON 驱动状态。请检查系统日志。' };
	if ([data.service, data.activation, data.bosa, serdes, mac].some(function(s) { return s && s.error != null && +s.error !== 0; }))
		return { text: '初始化异常', tone: 'danger', help: '光链路初始化未完成，请查看高级诊断中的错误码。' };
	if (flag((data.optical || {}).rx_los) || flag(serdes.rx_los))
		return { text: '光纤未连接', tone: 'danger', help: '检测到失光（LOS），请检查光纤连接和上联光信号。' };
	if (!flag(serdes.configured) || mac.enabled === '0' || /^epon/.test(serdes.mode) && mpcp.enabled === '0')
		return { text: '未启用', tone: 'muted', help: 'PON 尚未启动或已停用。' };
	if (/^(gpon|xgpon|xgspon)$/.test(serdes.mode))
		return mac.activation === 'O5' && flag(mac.prepared)
			? { text: '已激活 · O5', tone: 'good', help: 'PON 已激活；业务是否建立请结合上网接口状态确认。' }
			: { text: '等待激活', tone: 'warn', help: '当前激活状态：' + value(mac.activation) + '。激活不等同于上网成功。' };
	if (!flag(mpcp.enabled) || !/^[0-9a-f]+$/i.test(mpcp.registered || '') || !parseInt(mpcp.registered, 16))
		return { text: '等待注册', tone: 'warn', help: '光链路尚未完成 OLT 注册，请确认线路协议及认证信息。' };
	var ports = (data.oam_ports || []).filter(function(p) { return p.live && p.registered; });
	if (ports.some(function(p) { return p.auth_state === 'rejected'; }))
		return { text: '认证未通过', tone: 'danger', help: 'OLT 拒绝了订户认证，请核对运营商提供的 LOID 和密码。' };
	if (ports.some(function(p) { return p.auth_state === 'accepted' && p.discovery_stable; }))
		return { text: '已注册 · 认证通过', tone: 'good', help: 'PON 认证已通过。实际地址与连接状态见上网接口。' };
	return { text: '已注册 · 等待认证', tone: 'warn', help: '已完成 MPCP 注册；认证可能尚未完成，或线路无需 LOID。' };
}

function ponCard(data) {
	var state = ponState(data), optical = data.optical || {}, serdes = data.serdes || {};
	return card('PON 光链路', badge(state.text, state.tone), E('div', {}, [
		rows([['线路协议', modes[serdes.mode] || value(serdes.mode)],
			['接收光信号', serdes.rx_los == null ? '未提供' : (flag(serdes.rx_los) ? '失光' : '未检测到失光')],
			['光模块告警', optical.tx_fault == null ? '未提供' : (flag(optical.tx_fault) ? '发射故障' : '无发射故障')]]),
		E('p', { class: 'tyf-note' }, state.help),
		E('p', { class: 'tyf-note' }, '当前驱动未提供收发光功率、温度和电压读数。'),
		link('管理光链路 →', 'admin/network/pon')
	]));
}

function offloadCard(data) {
	var fe = data.fe || {}, available = flag(fe.available), enabled = flag(fe.enabled);
	var error = available && fe.error != null && +fe.error !== 0;
	return card('硬件转发', badge(error ? '运行异常' : !available ? '不可用' : enabled ? '已启用' : '未启用',
		error ? 'danger' : available && enabled ? 'good' : 'muted'), E('div', {}, [
		rows([['当前硬件流', value(fe.flows)], ['累计安装 / 释放', value(fe.installs) + ' / ' + value(fe.deletes)]]),
		E('p', { class: 'tyf-note' }, '启用状态不代表所有连接都已卸载；这里只显示驱动实时报告，不推算带宽或加速比例。')
	]));
}

function portCards(data) {
	return E('div', { class: 'tyf-grid tyf-ports' }, (data.ports || []).map(function(port) {
		var up = port.present && flag(port.carrier), stats = port.statistics || {};
		var pon = port.device === 'pon-data0';
		var speed = !up ? '—' : +port.speed > 0 ? (+port.speed >= 1000 ? (+port.speed / 1000) + ' Gbit/s' : port.speed + ' Mbit/s') : '未提供';
		return card(pon ? 'PON 业务口' : 'LAN · ' + port.device,
			badge(!port.present ? '未检测到' : port.carrier == null ? '状态未知' : up ? '链路已连接' : '链路未连接', up ? 'good' : 'muted'),
			rows([['系统设备', port.device], [pon ? '业务链路速率' : '协商速率', speed],
				['双工模式', !up ? '—' : port.duplex === 'full' ? '全双工' : port.duplex === 'half' ? '半双工' : '未提供'],
				['接收 / 发送', bytes(stats.rx_bytes) + ' / ' + bytes(stats.tx_bytes)],
				['收 / 发错误', value(stats.rx_errors) + ' / ' + value(stats.tx_errors)]]));
	}));
}

function interfaceCards(nets, runtime) {
	return E('div', { class: 'tyf-grid' }, nets.filter(function(net) { return net.getName() !== 'loopback'; }).map(function(net) {
		var active = (runtime || []).find(function(entry) { return entry.interface === net.getName(); }) || {};
		var addresses = net.getIPAddrs().concat(net.getIP6Addrs());
		return card(net.getName().toUpperCase(), badge(active.up ? '接口已启动' : '未连接', active.up ? 'good' : 'muted'), E('div', {}, [
			rows([['运行协议 / 设备', value(active.proto) + ' / ' + (active.l3_device || active.device || '未分配')],
				['IP 地址', addresses.length ? addresses.join(' · ') : '尚未获取'],
				['网关', net.getGatewayAddr() || net.getGateway6Addr() || '—'],
				['DNS', net.getDNSAddrs().concat(net.getDNS6Addrs()).join(' · ') || '—']]),
			link('接口设置 →', 'admin/network/network')
		]));
	}));
}

function wifiCards(wifis) {
	if (!wifis.length) return E('p', { class: 'tyf-note' }, '未发现无线网络；请在无线设置中检查设备和配置。');
	return E('div', { class: 'tyf-grid' }, wifis.map(function(wifi) {
		var disabled = wifi.isDisabled(), up = !disabled && wifi.isUp();
		return card(wifi.getActiveSSID() || wifi.getName(), badge(disabled ? '已关闭' : up ? '运行中' : '未就绪', up ? 'good' : 'muted'), E('div', {}, [
			rows([['无线设备', wifi.getWifiDeviceName()],
				['频率 / 信道', value(wifi.getFrequency()) + ' GHz / ' + value(wifi.getChannel())],
				['加密方式', up ? value(wifi.getActiveEncryption()) : '—']]),
			link('无线设置 →', 'admin/network/wireless')
		]));
	}));
}

return baseclass.extend({
	modes: modes, value: value, badge: badge, rows: rows, card: card, bytes: bytes,
	ponState: ponState, ponCard: ponCard, offloadCard: offloadCard, portCards: portCards,
	interfaceCards: interfaceCards, wifiCards: wifiCards,
	style: function() { return E('link', { rel: 'stylesheet', href: L.resource('tyfza1/status.css') }); },
	callStatus: callStatus,
	load: function() {
		return network.flushCache().catch(function() { return null; }).then(function() {
			return Promise.all([
				callStatus().then(function(data) { return { data: data }; }, function() { return { error: 'PON 和端口状态读取失败，请检查登录权限或 rpcd 服务。' }; }),
				// The LuCI network model substitutes empty data on RPC failure. Probe
				// availability so an RPC outage is not presented as disconnected ports.
				Promise.all([callInterfaces(), callWireless()]).then(function(state) {
					if (!state[0] || !Array.isArray(state[0].interface)) throw new Error('Missing interface status');
					return Promise.all([network.getNetworks(), network.getWifiNetworks(), state[0].interface]);
				}).then(function(data) {
					return { networks: data[0], wifis: data[1], runtime: data[2] };
				}, function() { return { error: '网络和无线状态读取失败，请检查 netifd / ubus 服务。' }; })
			]);
		});
	},
	renderOverview: function(data) {
		var pon = data[0], net = data[1];
		return E('div', { class: 'tyf-dashboard' }, [
			pon.error ? E('p', { class: 'alert-message warning', role: 'status' }, pon.error) :
				E('div', {}, [E('div', { class: 'tyf-grid' }, [ponCard(pon.data), offloadCard(pon.data)]),
					E('h3', { class: 'tyf-section-title' }, '有线端口'), portCards(pon.data),
					E('p', { class: 'tyf-note' }, 'LAN 按系统设备名区分，不将未确认的编号当作机身丝印。统计为设备累计计数，不等同于全部硬件卸载流量。')]),
			net.error ? E('p', { class: 'alert-message warning', role: 'status' }, net.error) :
				E('div', {}, [E('h3', { class: 'tyf-section-title' }, '网络接口'), interfaceCards(net.networks, net.runtime),
					E('h3', { class: 'tyf-section-title' }, '无线网络'), wifiCards(net.wifis)]),
			E('p', { class: 'tyf-note' }, '每 5 秒刷新。接口已连接表示本地链路或地址就绪，不代表已验证互联网连通性。')
		]);
	}
});
