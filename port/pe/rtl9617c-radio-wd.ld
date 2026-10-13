ENTRY(pe_entry)
SECTIONS
{
    . = 0xbfc00000;
    .entry : { *(.entry) }
    . = 0xbfc00380;
    .exception : { *(.exception) }
    . = 0x9fc00400;
    .text : AT(ADDR(.text) + 0x20000000) { *(.text*) }
    .rodata : AT(ADDR(.rodata) + 0x20000000) { *(.rodata*) }
    .data : AT(ADDR(.data) + 0x20000000) { *(.data*) }
    .bss : AT(ADDR(.bss) + 0x20000000) { *(.bss*) *(COMMON) }
    ASSERT(. <= 0x9fc02000, "PE code overlaps mailbox")
    . = 0x9fc02400;
    .rxq : AT(ADDR(.rxq) + 0x20000000) { *(.rxq) }
    /DISCARD/ : { *(.MIPS.abiflags) *(.reginfo) *(.pdr) *(.comment) *(.note*) }
}
ASSERT(. <= 0x9fc04000, "PE code overlaps request ring")
