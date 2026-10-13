'use strict';
'require view';
'require poll';
'require tyfza1.status as status';

return view.extend({
	load: function() { return status.load(); },
	render: function(data) {
		var panel = E('div', {}, status.renderOverview(data));
		poll.add(function() {
			return status.load().then(function(next) { panel.replaceChildren(status.renderOverview(next)); });
		}, 5);
		return E('div', { class: 'tyf-dashboard' }, [status.style(), E('h2', {}, 'TYFZA1 设备总览'),
			E('p', { class: 'tyf-note' }, '查看光链路、有线端口、网络接口和双频无线的实际运行状态。'),
			E('nav', { class: 'tyf-actions', 'aria-label': '常用管理入口' }, [
				E('a', { href: L.url('admin/network/pon') }, 'PON 管理'),
				E('a', { href: L.url('admin/network/network') }, '接口与 VLAN'),
				E('a', { href: L.url('admin/network/wireless') }, '无线设置'),
				E('a', { href: L.url('admin/network/dhcp') }, 'DHCP / DNS'),
				E('a', { href: L.url('admin/status/overview') }, '系统与终端'),
				E('a', { href: L.url('admin/status/logs') }, '系统日志')
			]), panel]);
	},
	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
