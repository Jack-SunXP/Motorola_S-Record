/**
 * 计算 S-Record 行的校验和（不含最后的校验和字节）
 * @param line S-Record 文件中的一行
 * @returns 计算得到的校验和（十进制），如果不是 S-Record 行则返回 null
 */
export function calcSrecChecksum(line: string): number | null {
    // 只处理以 S+数字 开头的行
    if (!/^S[0-9]/.test(line)) return null;

    // 去掉行首的 S 和类型号（如 S1、S2、S3 等）
    const data = line.slice(2);

    // 只保留十六进制字符（去除空格等）
    const hex = data.replace(/[^0-9A-Fa-f]/g, '');

    // 至少要有长度字节和校验和字节
    if (hex.length < 4) return null;

    let sum = 0;
    // 遍历除最后一个字节（校验和）外的所有字节，每两个字符为一个字节
    for (let i = 0; i < hex.length - 2; i += 2) {
        sum += parseInt(hex.substr(i, 2), 16);
    }
    // 取反并保留低8位
    sum = (~sum) & 0xFF;
    return sum;
}

/**
 * 获取 S-Record 行中声明的校验和字节
 * @param line S-Record 文件中的一行
 * @returns 行末声明的校验和（十进制），如果不是 S-Record 行则返回 null
 */
export function getLineChecksum(line: string): number | null {
    // 只处理以 S+数字 开头的行
    if (!/^S[0-9]/.test(line)) return null;

    // 只保留十六进制字符
    const hex = line.replace(/[^0-9A-Fa-f]/g, '');

    // 至少要有一个校验和字节
    if (hex.length < 2) return null;

    // 最后两个字符为校验和字节
    return parseInt(hex.substr(hex.length - 2, 2), 16);
}