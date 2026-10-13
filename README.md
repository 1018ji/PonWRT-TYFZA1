# PonWRT-TYFZA1

感谢 [PonWrt](https://github.com/pbs05/ponwrt) 在 PON 与 OpenWrt 整合、原厂身份和校准保留、硬件转发及排障思路上提供的参考。本项目针对天翼 TYFZA1 / Realtek RTL9617CVW 独立适配。

**版本：0.1.0-alpha** · OpenWrt · Linux 6.18.55 · 四核 Cortex-A55

## 功能与进度

| 功能 | 状态 |
| --- | --- |
| 系统启动、NAND/UBI、watchdog | 已实测 |
| 原厂 telnet 安装、sysupgrade、断电启动 | 已实测 |
| EPON-D10G 注册、CTC OAM、LOID、FEC、DHCP IPv4 | 已实测 |
| 四 LAN 网桥 | 已接入；四口逐口完整测试待完成 |
| 双频 WiFi、WPA2、HT/VHT80 | 已实测；HE 和更多终端兼容性待测试 |
| IPv4 路由/NAT、WiFi 双向硬件加速 | 双频上下行硬件路径已实测；持续高负载丢包待优化 |
| GPON、XG-PON、XGS-PON、其他 EPON 模式 | 适配进行中；业务与硬件转发待测试 |
| PPPoE | 已接入 OpenWrt 原生配置；拨号、业务与硬件转发待测试 |
| 桥接 | 业务与硬件转发待测试 |
| IPv6 | 已加入 DHCPv6、RA 和原生页面；公网、前缀下发与硬件转发待测试 |
| VLAN/QinQ、多 LLID、多业务 | 待测试 |
| 本版本冷启动、WiFi 停启、防火墙重载 | 已实测 |

支持手动选择 PON 模式。认证参数均可留空；MAC、SN 和厂商标识留空时使用本机原厂身份。镜像的身份和光学/射频校准从当前设备的原厂分区读取。

## 下载与刷入

在 [Releases](https://github.com/LeoooChen/PonWRT-TYFZA1/releases) 下载 `tyfza1-telnet-install.tar.gz` 或 `sysupgrade.bin`。

### 原厂系统安装

启用原厂 telnet，接好 LAN 网线并登录光猫。在电脑的安装包目录运行：

```sh
python3 -m http.server 8000
```

在光猫 telnet 中执行，将 `LAN_SERVER` 替换为电脑的 LAN 地址：

```sh
mkdir -p /tmp/tyfza1-install
wget -O /tmp/tyfza1-install.tar.gz http://LAN_SERVER:8000/tyfza1-telnet-install.tar.gz
tar -xzf /tmp/tyfza1-install.tar.gz -C /tmp/tyfza1-install
cd /tmp/tyfza1-install
sh ./install.sh
```

安装脚本更新原厂已有的 UBI 固件槽，保留原厂身份和校准，完成后自动重启。

### OpenWrt 升级

通过 **系统 → 备份与更新** 上传 `sysupgrade.bin`，或执行：

```sh
sysupgrade /tmp/sysupgrade.bin
```

默认保留配置；`sysupgrade -n` 恢复默认配置。

## 配置

通过 LAN 打开 `http://192.168.1.1/`，设置管理密码。

- **网络 → PON 管理**：选择线路协议，填写运营商要求的 LOID、密码、SN、ONU MAC 等可选参数。
- **网络 → 接口 → WAN**：使用 OpenWrt 原生 DHCP/PPPoE、VLAN 和 IPv6 设置。默认业务设备为 `pon-data0`，VLAN 使用 `pon-data0.VID`。
- **网络 → 无线**：设置名称、密码和国家/地区，然后启用无线。

## 自动编译

推送 `v*` 标签或手动运行 **Actions → Build TYFZA1 firmware**，自动编译并将安装包、升级镜像和校验值上传到 Release。

使用固定的 OpenWrt 和 feeds 版本。通用运行时输入位于首次 alpha 的 `tyfza1-runtime-inputs-v1.tar.gz` 附件；FIT 签名使用仓库 Secret `TYFZA1_FIT_SIGNING_KEY`。Fork 构建需配置与设备启动链匹配的密钥。

本地 Linux 构建：解压运行时输入，设置 `TYFZA1_RUNTIME_INPUTS` 和 `TYFZA1_SIGNING_KEYS` 后执行：

```sh
sh port/scripts/prepare.sh sources/openwrt
sh port/scripts/build.sh sources/openwrt "$(nproc)"
sh scripts/package_release.sh sources/openwrt artifacts/release
```

## 协议

源代码采用 [GNU GPL v2](COPYING)。第三方组件和原厂设备微码保留各自授权。
