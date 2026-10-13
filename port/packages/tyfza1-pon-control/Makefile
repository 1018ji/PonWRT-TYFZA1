include $(TOPDIR)/rules.mk

PKG_NAME:=tyfza1-pon-control
PKG_VERSION:=0.1.0
PKG_RELEASE:=1
PKG_LICENSE:=GPL-2.0-or-later

include $(INCLUDE_DIR)/package.mk

define Package/tyfza1-pon-control
  SECTION:=net
  CATEGORY:=Network
  TITLE:=Native RTL9617C PON identity and EPON OAM control
  DEPENDS:=+libuci +ucode +ucode-mod-fs
endef

define Build/Prepare
	mkdir -p $(PKG_BUILD_DIR)
	$(CP) ./src/* $(PKG_BUILD_DIR)/
endef

define Build/Compile
	$(TARGET_CC) $(TARGET_CPPFLAGS) $(TARGET_CFLAGS) -Wall -Wextra -Werror \
		$(PKG_BUILD_DIR)/pon-oamd.c $(PKG_BUILD_DIR)/pon-oam.c $(PKG_BUILD_DIR)/pon-backend.c \
		$(TARGET_LDFLAGS) -luci -o $(PKG_BUILD_DIR)/pon-oamd
	$(TARGET_CC) $(TARGET_CPPFLAGS) $(TARGET_CFLAGS) -Wall -Wextra -Werror \
		$(PKG_BUILD_DIR)/pon-identity.c $(TARGET_LDFLAGS) -luci -o $(PKG_BUILD_DIR)/pon-identity
endef

define Package/tyfza1-pon-control/install
	$(INSTALL_DIR) $(1)/usr/sbin
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/pon-oamd $(1)/usr/sbin/pon-oamd
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/pon-identity $(1)/usr/sbin/pon-identity
	$(INSTALL_DIR) $(1)/usr/share/tyfza1
	$(INSTALL_BIN) ./files/factory.uc $(1)/usr/share/tyfza1/factory.uc
endef

$(eval $(call BuildPackage,tyfza1-pon-control))
