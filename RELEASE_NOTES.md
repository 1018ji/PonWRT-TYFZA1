## 0.2.0-alpha

- 完善双频 Wi-Fi 6 的 HE 协商、动态速率、LDPC 和发包参数。
- 接入 RTL8221B 2.5G 网口、HiSGMII 切换及 NI/QM/FE 收发路径。
- 补齐 GPON、XG-PON、XGS-PON 的 OMCI 管理与业务 GEM/T-CONT 映射。
- 增加 XG/XGS 密钥交换、广播密钥和失步恢复，接通现有认证页面。
- 对照原厂驱动，参考 PonWrt 的标准协议实现。
- 修复自定义编译覆盖软件包配置，补齐设备默认无线驱动和运行组件。
- 按原厂 UBI 容量检查镜像大小，接入安装与 sysupgrade 流程。

新增功能的实机兼容性、上下行硬件转发和持续负载待测试。安装方法见 README。
