'use strict';
'require baseclass';
'require tyfza1.status as status';

return baseclass.extend({
	title: '光猫状态',
	load: function() { return status.callStatus().catch(function() { return null; }); },
	render: function(data) {
		return E('div', { class: 'tyf-dashboard' }, [status.style(),
			data ? E('div', { class: 'tyf-grid' }, [status.ponCard(data), status.offloadCard(data)]) :
				E('p', { role: 'status' }, '光猫状态读取失败；请检查权限或 rpcd 服务。'),
			E('a', { href: L.url('admin/status/tyfza1') }, '打开设备总览，查看端口、上网和无线状态 →')
		]);
	}
});
