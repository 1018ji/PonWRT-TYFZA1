/* SPDX-License-Identifier: GPL-2.0-or-later */
#ifndef RTL9617C_PON_PATH_H
#define RTL9617C_PON_PATH_H

#define RTL_ITU_PATH_MAX 248
#define RTL_ITU_PATH_WIRE_BYTES 12

struct rtl_itu_path {
	unsigned short alloc_id, gem_id, vlan, tcont;
	unsigned char pbits, multicast, queue, encrypted, index;
};

struct rtl_itu_paths {
	unsigned int count;
	struct rtl_itu_path path[RTL_ITU_PATH_MAX];
};

static inline const struct rtl_itu_path *rtl_itu_path_select(const struct rtl_itu_paths *paths,
		unsigned int vlan, unsigned int priority)
{
	const struct rtl_itu_path *selected = 0;
	unsigned int i;

	for (i = 0; i < paths->count; i++) {
		const struct rtl_itu_path *path = &paths->path[i];

		if (path->multicast || !(path->pbits & (1U << priority)) ||
		    (path->vlan != 65535 && path->vlan != vlan))
			continue;
		if (!selected || (selected->vlan == 65535 && path->vlan != 65535))
			selected = path;
	}
	return selected;
}

/* A Linux flowtable rule matches VID but carries no Ethernet PCP match. */
static inline const struct rtl_itu_path *rtl_itu_path_flow(const struct rtl_itu_paths *paths,
		unsigned int vlan)
{
	const struct rtl_itu_path *first = rtl_itu_path_select(paths, vlan, 0), *path;
	unsigned int priority;

	if (!first)
		return 0;
	for (priority = 1; priority < 8; priority++) {
		path = rtl_itu_path_select(paths, vlan, priority);
		if (!path || path->index != first->index || path->queue != first->queue)
			return 0;
	}
	return first;
}
#endif
