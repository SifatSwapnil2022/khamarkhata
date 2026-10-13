import { describe, expect, it } from "vitest";
import { formatBdPhone, maskPhone, normalizeBdPhone } from "@/lib/phone";

describe("normalizeBdPhone", () => {
  it.each([
    ["01712345678", "+8801712345678"],
    ["8801712345678", "+8801712345678"],
    ["+8801712345678", "+8801712345678"],
    ["017-1234 5678", "+8801712345678"],
    ["০১৭১২৩৪৫৬৭৮", "+8801712345678"],
    ["01312345678", "+8801312345678"],
  ])("accepts %s", (input, expected) => {
    expect(normalizeBdPhone(input)).toBe(expected);
  });

  it.each(["", "0171234567", "017123456789", "01212345678", "02123456789", "+447911123456", "abc"])(
    "rejects %s",
    (input) => {
      expect(normalizeBdPhone(input)).toBeNull();
    },
  );
});

describe("display helpers", () => {
  it("formats and masks", () => {
    expect(formatBdPhone("+8801712345678")).toBe("01712-345678");
    expect(maskPhone("+8801712345678")).toBe("017•••••678");
  });
});
