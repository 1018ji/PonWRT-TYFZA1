// SPDX-License-Identifier: GPL-2.0-or-later
/* XG-PON/XGS-PON preparation from this board's original XGTC initializers. */
#include <linux/delay.h>
#include <linux/io.h>
#include <linux/iopoll.h>
#include "rtl9617c-pon.h"
#include "rtl9617c-xgpon-hw.h"

static unsigned int rtl_xgpon_read(void *context, unsigned int reg)
{
	return readl(((struct rtl9617c_pon *)context)->mac + reg);
}

static void rtl_xgpon_write(void *context, unsigned int reg, unsigned int value)
{
	writel(value, ((struct rtl9617c_pon *)context)->mac + reg);
}

static int rtl_xgpon_indirect(void *context, unsigned int reg, unsigned int value)
{
	struct rtl9617c_pon *pon = context;
	u32 status;

	writel(value, pon->mac + reg);
	return readl_poll_timeout(pon->mac + reg, status, !(status & BIT(31)), 1, 100000);
}

ssize_t rtl_pon_xgpon_identity(struct rtl9617c_pon *pon, const char *buf, size_t count)
{
	ssize_t ret = count;

	if (count != 44)
		return -EMSGSIZE;
	mutex_lock(&pon->control_lock);
	mutex_lock(&pon->lock);
	if (rtl_pon_mode_is_epon(pon->mode) || pon->mode == RTL_PON_GPON)
		ret = -EOPNOTSUPP;
	else {
		memcpy(pon->xgpon_serial, buf, 8);
		memcpy(pon->xgpon_registration, buf + 8, 36);
		pon->xgpon_identity_configured = true;
	}
	mutex_unlock(&pon->lock);
	mutex_unlock(&pon->control_lock);
	return ret;
}

int rtl_pon_xgpon_prepare_locked(struct rtl9617c_pon *pon)
{
	const struct rtl_dq_io io = {pon, rtl_xgpon_read, rtl_xgpon_write, rtl_xgpon_indirect};
	unsigned int index;
	bool symmetric = pon->mode == RTL_PON_XGSPON;
	int ret = 0;

	lockdep_assert_held(&pon->control_lock);
	gpiod_set_value_cansleep(pon->tx_disable, 1);
	rtl_pon_gpon_stop_locked(pon);
	rtl_pon_mpcp_stop_locked(pon);
	mutex_lock(&pon->lock);
	pon->mac_prepared = false;
	if (pon->mode != RTL_PON_XGPON && pon->mode != RTL_PON_XGSPON) {
		ret = -EOPNOTSUPP;
		goto unlock;
	}
	if (!pon->serdes_configured || !pon->xgpon_identity_configured) {
		ret = -EAGAIN;
		goto unlock;
	}
	pon->puc_configured = false;
	pon->pdc_configured = false;
	pon->traffic_enabled = false;
	pon->xgpon_pending_valid = false;
	writel(0x00e, pon->control);
	writel(0x300, pon->gpon_control);
	msleep(1);
	writel(0x30e, pon->control);
	writel(0x307, pon->gpon_control);
	msleep(1);
	writel(symmetric ? 0x305 : 0x205, pon->gpon_control);
	msleep(1);
	rtl_xgpon_mac_parameters(&io, symmetric);
	rtl_xgpon_identity(&io, pon->xgpon_serial, pon->xgpon_registration);
	/* Start without mappings from any preceding ONU session. */
	for (index = 0; index < 32; index++) {
		ret = rtl_xgpon_tcont_set(&io, index, 0x3fff, false, false);
		if (ret)
			goto unlock;
	}
	for (index = 0; index < 256; index++) {
		rtl_xgpon_downstream_gem_set(&io, index, 0, false, false);
		ret = rtl_xgpon_upstream_gem_set(&io, index, 0, false, false, false);
		if (ret)
			goto unlock;
	}
	pon->mac_prepared = true;
	dev_info(pon->dev, "%s MAC identity, ACTP and data blocks prepared; activation disabled\n",
		rtl_pon_mode_name(pon->mode));
unlock:
	pon->mac_error = ret;
	mutex_unlock(&pon->lock);
	return ret;
}
