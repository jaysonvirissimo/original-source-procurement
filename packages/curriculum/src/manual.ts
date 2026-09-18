import type { ManualEntry } from "@osp/mission-schema";

/**
 * Manual entries. Skills, annotations, and mission terms link to them, and
 * ORIENTATION entries are read in the order listed here.
 */
export const manualEntries: readonly ManualEntry[] = [
  {
    id: "c.integer-types",
    section: "C",
    title: "Integer types",
    body: [
      "int is 32 bits. short is 16 bits. char is 8 bits.",
      "A char is a 1-byte integer, not a string. Game data often stores small numbers, such as a delta or a count, in char fields to save memory.",
      "signed char holds -128 to 127. unsigned char holds 0 to 255.",
      "Signed bytes use two's complement: the top bit counts as -128 instead of +128. So 0xFD, 1111 1101 in binary, is -128 + 125 = -3 as signed char and 253 as unsigned char.",
      "Using a byte as a 32-bit int widens it. Sign extension copies the top bit into the new bits, so -3 stays -3. Zero extension fills them with zeros, so 253 stays 253.",
      "Plain char is unsigned in PsyQ, the compiler the game was built with. A field declared as char behaves like unsigned char, not signed char. That is a PsyQ rule: other compilers may treat plain char as signed.",
    ],
  },
  {
    id: "c.pointers",
    section: "C",
    title: "Pointers",
    body: [
      "A pointer holds an address. int *p means p holds the address of an int.",
      "*p reads the int at that address. *p = v writes v there.",
      "& takes an address. If an int x is stored at 0x1000, &x is 0x1000, and calling f(&x) gives f a pointer to x.",
      "* has three roles. In a * 8 it multiplies. In the declaration int *p it says p holds an address. In the expression *p it reads or writes the int at that address.",
      "p = q changes which address p holds, and nothing else. *p = v writes into the memory p points to, so the caller's variable changes. A void function returns nothing, and this is how it hands back a result.",
      "A pointer argument arrives in an argument register like any other value. The load or store uses that register as its base.",
    ],
  },
  {
    id: "c.structs",
    section: "C",
    title: "Structs",
    body: [
      "A struct places its fields one after another in memory. Each field sits at a fixed offset from the start of the struct.",
      "In struct Obj { int a; int b; int c; }, a is at offset 0, b at 4, and c at 8, because each int takes 4 bytes.",
      "A char field takes 1 byte. After int id, a char delta sits at offset 4 and the next char at offset 5.",
      "o->c reads the field c of the struct that o points to: memory at o plus the offset of c.",
      "The declaration struct Obj { int a; int b; int c; }; describes a layout and creates nothing. An instance is actual memory with that layout. Unlike a JavaScript object, a struct cannot gain fields, and each field has a fixed type, size, and offset.",
      "With an instance itself, write obj.c. With a pointer to one, write o->c, which means (*o).c. Functions usually take struct Obj *o, the struct's address, so the struct is not copied.",
      "Offsets are not always the sum of the sizes before them. A layout can contain padding, unused bytes that line a field up. struct Obj holds only ints, so it has none. Struct layout, in the C section, covers padding.",
    ],
  },
  {
    id: "c.arrays",
    section: "C",
    title: "Arrays",
    body: [
      "int samples[4]; declares four ints stored back to back. Each is an element. The array takes 4 × 4 = 16 bytes.",
      "samples[i] is element i. Indexes count from 0, so samples[3] is the last of four, and it sits 3 × 4 = 12 bytes from the start of the array.",
      "Inside a struct, an array takes its whole size. In struct Log { int samples[4]; int total; }, total is at offset 16.",
      "With a constant index, the compiler adds the element's offset to the field's offset and loads once, just as for an ordinary field.",
      "The name of an array, used as a value, is the address of element 0. A variable index needs arithmetic on that address, which later missions cover.",
    ],
  },
  {
    id: "c.nested-structs",
    section: "C",
    title: "Pointers in structs",
    body: [
      "A field can hold a pointer. In struct Unit { int id; struct Pos *pos; }, pos is a 4-byte address. The struct Pos it points to lives somewhere else in memory.",
      "u->pos->y follows the chain: load pos from u, then load y from the struct at that address. That takes two loads.",
      "The chain can also be written with a local pointer: struct Pos *p = u->pos; return p->y;. Both compile to the same instructions.",
      "An embedded struct is different. In struct Unit2 { int id; struct Pos pos; }, the x and y of pos sit inside Unit2 itself, at offsets 4 and 8. Reach them with a dot, u->pos.y, and a single load.",
      "Read the declaration: a * before the field name means a pointer to data elsewhere. No * means the data is right there.",
    ],
  },
  {
    id: "c.integer-widths",
    section: "C",
    title: "Integer widths",
    body: [
      "On this target, char takes 1 byte (8 bits), short takes 2 bytes (16 bits), and int takes 4 bytes (32 bits). Pointers also take 4 bytes.",
      "The load instruction shows the width. lb and lbu read 1 byte, lh and lhu read 2, and lw reads 4.",
      "Signed widths sign-extend to 32 bits and unsigned widths zero-extend. short loads with lh, and unsigned short with lhu.",
      "A short holds -32768 to 32767. 0xFFFE read as a short is -2.",
      "These sizes are this target's. C only sets minimums, and other machines can differ.",
    ],
  },
  {
    id: "c.struct-layout",
    section: "C",
    title: "Struct layout",
    body: [
      "Each field has an alignment: on this target, 1 for char, 2 for short, and 4 for int and pointers. A field starts at the next offset that is a multiple of its alignment.",
      "Bytes skipped to reach that offset are padding. In struct Mixed { char tag; int count; }, tag is at 0 and count at 4, with 3 padding bytes between.",
      "An embedded struct takes its whole size and aligns to its largest member. Its fields' offsets inside the outer struct are its own offset plus theirs.",
      "To find an offset, walk the fields in order: round up to the field's alignment, place it, then add its size.",
      "The whole struct's size is also rounded up to its largest alignment, so arrays of it line up too.",
    ],
  },
  {
    id: "c.pointer-arithmetic",
    section: "C",
    title: "Pointer arithmetic",
    body: [
      "Adding n to a pointer moves it n elements of the type it points to. For int *words, words + 3 is 12 bytes further. For char *text, text + 3 is 3 bytes further.",
      "The listing shows the byte count, because the compiler has already multiplied. Divide by the element size to get the n in the source.",
      "words + 3 is the address of words[3]. It computes an address and copies no data.",
      "The compiler can compute words + 3 in a register without changing words. Register reuse, under MATCHING, explains why.",
      "Storing a pointer into a field copies the address, not the data at that address. Storing addresses, under C, has more.",
      "void * has no element size, so standard C forbids adding to it. PsyQ, a GNU compiler, accepts it and moves 1 byte per step. That is compiler-specific behavior.",
    ],
  },
  {
    id: "c.typedef",
    section: "C",
    title: "Type names and headers",
    body: [
      "typedef gives a type another name. typedef struct { int kind; void *data; } Slot; names that struct Slot, so Slot *s declares a pointer to it.",
      'A header file, such as bridge_types.h, holds declarations shared by several source files. #include "bridge_types.h" pastes its text into the source before compiling.',
      "A typedef creates no memory and changes no layout. Slot has kind at offset 0 and data at offset 4, just as the struct written out would.",
      "void * is a generic pointer: an address of anything. It is a different use of void from a function that returns nothing.",
      "Storing a void * copies the address. Reading the data behind it needs a pointer of a specific type.",
    ],
  },
  {
    id: "c.bit-operations",
    section: "C",
    title: "Bit operations",
    body: [
      "A value is a row of bits. & keeps a bit only where both sides have it, | keeps a bit where either side has it, and ^ keeps a bit where exactly one side has it.",
      "A mask is a constant chosen for its bit pattern rather than its size. a & 0xFF keeps the low 8 bits and clears the rest, because 0xFF is eight 1 bits. The result is whatever those 8 bits held, so it ranges from 0 to 255.",
      "Masking with a constant that fits in 16 bits compiles to one instruction, andi. A wider mask does not fit inside the instruction, so the compiler first builds the constant in a register and then uses the two-register form, and. Two instructions instead of one, from changing only the constant.",
      "Between two registers the forms are and, or, and xor, with no constant to carry.",
      "Masking and shifting are often used together: a shift moves the bits you want into place, and a mask discards the rest.",
    ],
  },
  {
    id: "c.static-storage",
    section: "C",
    title: "Static storage",
    body: [
      "A variable declared outside every function exists for the whole run, at one fixed place in memory. Nothing passes it in, so a function that uses one has to produce its address itself.",
      "Reading a field through a pointer takes one instruction, because the address is already in a register. Reading a variable like this takes two: one to build the address, one to use it.",
      "The address is not known while the function is being compiled, because where the variable lands is decided when the whole program is linked. So both halves of it read as zero in the listing, and the real value is filled in later. The comparison knows this: it checks which variable a row refers to, and ignores the bits that are still to be filled.",
      "Declaring the variable static changes who else may name it, not where it lives or how it is read. The instructions are the same either way.",
      "There is a second form. When a file is compiled with small-data addressing, the program keeps one register pointing at a block of such variables, and reading one takes a single instruction with an offset from that register instead of two. The game's own files are built that way, so the field missions show that form rather than this one.",
    ],
  },
  {
    id: "c.conditions",
    section: "C",
    title: "Conditions",
    body: [
      "In C a question such as a < b is an expression with a value, not something that only belongs inside an if. Its value is 1 when the answer is yes and 0 when it is no, and you can return it, assign it, or add it up.",
      "That is why a function whose whole body is return a < b; compiles to so little: one instruction answers the question and leaves the answer where a return value goes.",
      "C counts any non-zero value as yes, so !a is another way of asking a == 0, and the compiler emits the same instruction for both. Neither is more correct; they are the same program.",
      "The operators are <, >, <=, >=, == and !=. Only the first has an instruction of its own. The others are that instruction with the operands reordered, with the answer flipped, or with an extra step first.",
      "Signedness matters here as much as it does on a load. Whether one value is less than another depends on whether both are read as signed or unsigned, and the declared types of the operands decide which question the compiler asks.",
    ],
  },
  {
    id: "mips.arithmetic",
    section: "MIPS",
    title: "Arithmetic",
    body: [
      "addiu $v0,$a0,imm stores $a0 plus a constant in $v0.",
      "An immediate is a constant written inside the instruction itself, rather than read from a register. In addiu it has 16 bits, so it ranges from -32768 to 32767.",
      "The processor widens the immediate to 32 bits by sign extension: it copies the top bit into the new bits, so a negative constant stays negative. The u in addiu does not mean unsigned. It means an overflow does not stop the program.",
      "sll $v0,$a0,n stores $a0 shifted left by n bits in $v0. Every bit moves n places toward the high end and zeros fill the low places. Each place doubles the value, so shifting left by n multiplies by 2 to the power n.",
      "In C, a << 3 shifts left by 3 and a * 8 multiplies by 8. The compiler emits the same sll for both, so either one matches. A match shows the output is the same, not that the original source used that exact text.",
      "The analogy has limits. Bits shifted past the top are lost, so a large value overflows, and shifting right does not divide negative numbers the same way. Later missions cover those cases.",
      "The listing shows immediates in hexadecimal: 0x5 is 5 and 0x2A is 42. Shift amounts are decimal.",
      "When one expression needs two steps, the compiler keeps the intermediate value in a register, often the destination register itself.",
      "C applies * before +, and + before <<. Parentheses change the order: (a + 3) * 4 adds first, while a + 3 * 4 multiplies 3 by 4 first.",
      "addu $v0,$a0,$a1 adds two registers instead of a register and a constant, and subu $v0,$a0,$a1 subtracts the second from the first. Neither carries an immediate, so the order of the operands is the order in the source: b - a swaps the two registers rather than negating anything.",
      "There is no subtract-immediate instruction. a - 5 therefore compiles to an add of a negative constant, and the listing shows it as one: addiu $v0,$a0,-0x5. Subtracting from a constant is different work, because the constant has to reach a register first, so 5 - a takes an extra instruction.",
      "The compiler may reshape arithmetic into cheaper instructions. a * 2 becomes a single shift, and a * 3 becomes a shift followed by an add, because both are faster than a multiply. Several C expressions can therefore produce the same words, and matching one of them is a match.",
      "Shifting right has two instructions, and which one appears depends on the type being shifted. srl moves every bit toward the low end and fills the top with zeros. sra fills the top by copying the sign bit instead, so a negative value stays negative.",
      "An unsigned value shifts with srl and a signed one with sra. That is why a >> 1 is not simply a halving: for a signed value the compiler must keep the sign, and dividing a signed value by a power of two takes more than one instruction because it also has to round toward zero.",
    ],
  },
  {
    id: "mips.loads-and-stores",
    section: "MIPS",
    title: "Loads and stores",
    body: [
      "Memory is a long row of bytes, each with its own address. A byte is 8 bits. An int, like an instruction, is a 32-bit word that takes 4 bytes at consecutive addresses.",
      "A register holds 32 bits with no type. Sometimes they are a number to calculate with, like a in 003. Sometimes they are an address, like p in 006. The instruction decides: lw treats its base register as an address.",
      "Memory is reached through a base register plus an offset. lw $v0,0x8($a0) reads 32 bits from the address in $a0 plus 8. The parentheses hold the base; they are not a call.",
      "sw $a1,0x0($a0) writes the 32 bits in $a1 to the address in $a0. A store's first operand is the source, not a destination: the value flows from $a1 into memory, and no register changes. With p in $a0 and v in $a1, this is *p = v.",
      "lb and lbu read 8 bits. lb sign-extends the byte to 32 bits; lbu zero-extends it.",
      "A signed char loads with lb. An unsigned char or a plain char loads with lbu.",
      "lh and lhu read 16 bits, the same pair as lb and lbu one width up: lh sign-extends the halfword to 32 bits and lhu zero-extends it. A short field loads with lh and an unsigned short with lhu.",
      "Stores come in the same widths: sw writes 4 bytes, sh writes 2, and sb writes 1. Each writes the low bits of its source register and leaves the rest of the register alone.",
      "A store has no signedness. sb writes a byte whether the field is signed char or unsigned char, because signedness decides how a value is read back, never how it is written. There is no sbu or shu.",
      "The offset shows which field is read; the instruction shows its width and signedness.",
    ],
  },
  {
    id: "mips.delay-slots",
    section: "MIPS",
    title: "Delay slots",
    body: [
      "The instruction right after a jump or branch is its delay slot. It runs before control reaches the new address.",
      "jr $ra returns to the caller. The instruction after it still runs first, so the compiler often places the last step of a function there.",
      "When nothing useful can run in the delay slot, the assembler fills it with a nop.",
      "This is why a two-instruction function reads back to front. The return comes first and the work comes second, and both run. A listing that ends in the middle of the work is not truncated; that last row is the delay slot.",
      "A branch has one too, and it is stranger. The row after a branch belongs to neither path: it runs whether or not the branch is taken. The compiler knows that, so it often puts work there that one path needs and the other simply overwrites.",
      "So a row after a branch is not part of the block it sits beside. Read it as happening first, before the question is settled.",
      "At the bottom of a loop the slot is stranger again. It runs on every pass and once more on the way out, because the last pass still runs the row after the branch that decided to stop. Work the compiler puts there must either be harmless on that final run or be taken back out afterwards.",
      "j has a delay slot too. The row after it runs before the jump lands, so it belongs to the path the jump ends, not to whatever is written below it.",
    ],
  },
  {
    id: "mips.comparison",
    section: "MIPS",
    title: "Tests",
    body: [
      "slt $v0,$a0,$a1 writes 1 into $v0 when $a0 is less than $a1, and 0 otherwise. Its name is set on less than. slti compares against a constant instead of a second register.",
      "There is one test instruction and one direction. No instruction asks whether something is greater, or equal, or not equal; everything else is built from set on less than.",
      "Greater than needs no extra instruction, only the operands the other way round: a > b is the same question as b < a, so the listing shows slt with its two source registers swapped.",
      "Adding or-equal takes one more instruction. a <= b is b < a answered and then flipped, and the flip is xori $v0,$v0,0x1, which turns 1 into 0 and 0 into 1.",
      "Equality is not a test at all. a == b first combines the two values with xor, which gives zero exactly when they are equal, and then asks whether that result is less than 1. Against zero the xor is unnecessary, so a == 0 is a single sltiu $v0,$a0,0x1.",
      "Against zero the compiler can do better still. a < 0 asks only whether the sign bit is set, and the listing shows srl $v0,$a0,31, a shift, with no test instruction anywhere.",
    ],
  },
  {
    id: "mips.branches",
    section: "MIPS",
    title: "Branches",
    body: [
      "A branch skips forward when its question is answered yes. Everything between the branch and where it lands is a path that only sometimes runs.",
      "After a test, the branch reads the test's answer: beq goes when the value is zero and bne when it is not. The listing usually shows them as beqz and bnez, which is the same instruction compared against nothing.",
      "Against zero there is no test at all. bltz goes when a value is negative, bgez when it is not, bgtz when it is above zero, and blez when it is at most zero. One instruction asks and jumps, where a comparison against anything else needs two.",
      "The number on a branch is a distance, not an address. It counts bytes from the branch's own row, and a row is 4 bytes, so .+12 lands three rows further down. It is written in decimal even though other constants are hexadecimal.",
      "Counting those rows is how you find where a path ends. The listing does not draw it for you.",
      "A distance can be negative. .-4 lands one row up, on a row that has already run, so the rows from there down to the branch run again. That is a loop, and it is the only way this compiler writes one.",
    ],
  },
  {
    id: "mips.loops",
    section: "MIPS",
    title: "Loops",
    body: [
      "A loop is a branch that points backward. It sits at the bottom of the rows it repeats, asks its question there, and while the answer is yes goes back up to the first of them. When the answer is no, the row after it runs and the function carries on below.",
      "That is a do/while: the body runs once before the question is ever asked. do { a = a - 1; } while (a > 0); compiles to the subtraction, then bgtz $a0 pointing back at it.",
      "A while loop asks first, and a body that runs zero times is a different program. The compiler does not build a second kind of loop for it. It writes the same do/while, and puts one extra branch in front, the guard, which asks the opposite question and skips the whole loop when the body should not run at all.",
      "So while (a > 0) begins with blez $a0: at most zero, skip everything. The branch at the bottom is still bgtz. The two ask opposite questions about the same value, and a listing that has both is a while; a listing with only the one at the bottom is a do/while.",
      "A for loop is a while loop with its first and last steps written in the header. for (i = 0; i < n; i = i + 1) sets i before the guard and adds 1 at the bottom of every pass, so it compiles to the same guard, body and backward branch.",
      "The guard has a delay slot like any branch, and it runs whether or not the loop is skipped. The compiler usually puts the loop's starting value there, which is correct on both paths.",
    ],
  },
  {
    id: "mips.jumps",
    section: "MIPS",
    title: "Jumps",
    body: [
      "j goes somewhere else with no question asked. jr $ra is the one you already know: it goes to the address held in a register. j carries its destination inside the instruction instead.",
      "An if/else needs one. The branch at the top chooses between the two arms, but when the first arm finishes, something has to stop it running straight on into the second. That something is j, pointing past the else.",
      "In the target it reads j 0x0. The destination is an address, and addresses are not known until the linker has placed every function, so the compiler leaves the field zero and records a relocation saying where it should point. The comparison checks that relocation, not the zeros, exactly as it did for a global's address.",
      "The comparison describes the destination as .text plus a number of bytes. .text is where the code lives, and in a mission's listing the function starts at byte 0, so .text+0x18 is 24 bytes in: row 6.",
      "Like every jump, j has a delay slot, and the compiler usually puts the last step of the first arm there. So the row after j belongs to the arm above it, not to the else below it.",
      "An if with no else needs no jump. When one arm only sets a default that the other replaces, the compiler puts the default in the branch's delay slot and there is nothing to skip.",
    ],
  },
  {
    id: "mips.assembler-nops",
    section: "MIPS",
    title: "Assembler-inserted nops",
    body: [
      "A nop is an instruction that does nothing.",
      "The compiler, PsyQ, translates C into assembly. The assembler, ASPSX, turns that assembly into words. Some nops are not in the compiler's output: the assembler inserts them.",
      "A branch delay nop fills a delay slot that has nothing else to run. In 001, addiu does useful work in jr's delay slot, so no nop is needed there.",
      "A load delay nop follows a load when the next instruction reads the register just loaded. The loaded value is not ready one instruction later.",
      "These nops are part of the target. Matching C produces them too.",
    ],
  },
  {
    id: "abi.arguments",
    section: "ABI",
    title: "Arguments",
    body: [
      "The first four integer or pointer arguments arrive in $a0, $a1, $a2, and $a3, in order.",
      "In int f(int a, int b), a is in $a0 and b is in $a1 when the function starts.",
      "Registers to know now: $a0 to $a3 carry arguments, $v0 carries the return value, $ra holds the return address, and $zero always reads 0.",
      "Other names, such as $v1, $s0 to $s7, $t0 to $t9, and $sp, appear in later missions. You can ignore them for now.",
    ],
  },
  {
    id: "abi.return-values",
    section: "ABI",
    title: "Return values",
    body: [
      "A function returns an int or a pointer in $v0.",
      "jr $ra jumps back to the caller, whose return address is in $ra.",
      "A void function sets no return value. It can still use $v0 and $v1 for intermediate values while it runs.",
    ],
  },
  {
    id: "matching.signedness",
    section: "MATCHING",
    title: "Signedness",
    body: [
      "Two C programs can do the same useful work and still assemble differently. Matching needs the same words.",
      "A byte field declared with the wrong signedness loads with the wrong instruction: lbu instead of lb, or the reverse.",
      "Fix it where the type is declared. If the target uses lb, the field is signed char. If it uses lbu, it is unsigned char or plain char.",
      "The same rule holds one width up. lh means short and lhu means unsigned short, and a halfword field declared with the wrong signedness misses by exactly one instruction, the way a byte field does.",
      "Stores are not part of this. A narrow store picks its instruction from the width alone, so a wrong signedness on a field that is only written cannot show up in the listing.",
    ],
  },
  {
    id: "matching.register-reuse",
    section: "MATCHING",
    title: "Register reuse",
    body: [
      "A register holds whatever the compiler last put in it. The compiler picks registers for values, not for the names in your source.",
      "When an expression such as p + 4 is needed once, the compiler may compute it in the register that held p. After that instruction the register holds the new address, but the variable p in your source has not changed.",
      "So when a listing writes a new value into an argument register, do not look for an assignment to that parameter. Look for the expression whose result the register now holds.",
      "Naming the result first, as in char *end = p + 4;, often assembles to the same words, because the compiler does not keep the extra name.",
    ],
  },
  {
    id: "matching.expression-shape",
    section: "MATCHING",
    title: "Expression shape",
    body: [
      "Two ways of writing the same question can compile to different words, and only one of them matches. The meaning being right is not the same as the shape being right.",
      "Order is the common case. a > b and b < a are the same question, and the machine has only one of them, so the listing decides which way round your source has to read. Look at which register the test reads first.",
      "An extra instruction is the second case. If the listing tests and then flips the answer, the source asked an or-equal question. If it flips first, or does not flip at all, it did not.",
      "The third case is the one that catches people, because the answer stops looking like a test. Asked whether a value is below zero, the compiler reads the sign bit with a shift. Nothing in the listing resembles the question you asked, and writing a test there will never match.",
      "So read the listing for the shape, not only for the meaning. When your output and the target both do the right thing but differ by a register order or by one extra instruction, the difference is the shape of the expression, not a mistake about what the function does.",
    ],
  },
  {
    id: "matching.branch-sense",
    section: "MATCHING",
    title: "Which way a test reads",
    body: [
      "Every question has an opposite. Asking whether a value is below another and acting on yes does the same work as asking whether it is not below and acting on no, with the two paths written the other way round.",
      "Both are correct C and they compile differently. The branch instruction changes, and so does the order the two paths appear in the listing.",
      "The comparison names both halves of that when it happens. A difference in the branch itself is reported as a branch condition; the paths appearing in the other order is reported separately as an instruction order. Those two together are the signature of a test written the opposite way round, not two unrelated mistakes.",
      "Fix it by reading the branch first. It tells you which question the source asked, and the path immediately after it is the one that runs when the answer is no.",
    ],
  },
  {
    id: "matching.loop-shape",
    section: "MATCHING",
    title: "The shape of a loop",
    body: [
      "The compiler rearranges loops more than anything else in this course, and the listing only makes sense once you expect it to.",
      "The row after the backward branch is its delay slot. It runs on every pass, including the last one, after which the loop has already decided to stop. When the compiler moves real work into that slot, the final pass does that work once too often, and a row after the loop takes it back out: an add in the slot, a subtract of the same register below.",
      "That is why the order of the lines in the body matters. With n = n + a; a = a - 1; the add is the work that can wait for the slot, so the compiler does the first add above the loop and adds each next value in the slot, and the subtract after the loop undoes the one that ran on the way out. Swap the two lines and the add already uses the value the test just read, so nothing needs undoing and both rows disappear.",
      "An array indexed by a counter does not compile to a multiply. p[i] in a loop becomes a pointer that starts at p and moves forward by the size of one element on every pass, 4 bytes for an int, so the load always reads offset 0. The counter survives only as the number the exit test reads.",
      "That is where to read the step. If the counter moves by 2, the pointer moves by 8: the element size times the step, worked out by the compiler, not written anywhere in the source.",
      "The compiler will sometimes turn a loop round and count down instead of up when the counter is not used for anything else, so a listing that runs backward is not proof that the source did.",
    ],
  },
  {
    id: "c.storing-addresses",
    section: "C",
    title: "Storing addresses",
    body: [
      "A pointer is an address. Assigning one, as in o->data = p;, copies that address: 4 bytes on this machine, stored with one sw.",
      "The memory at that address is not copied. Afterwards o->data and p name the same bytes, so a change made through one is visible through the other.",
      "Copying the contents takes more: a loop, a struct assignment, or a call such as memcpy. Each of those assembles to more than a single store.",
      "Storing p + n stores a different address, n elements further along. The data still stays where it is.",
    ],
  },
  {
    id: "mips.instruction-reading",
    section: "MIPS",
    title: "Instruction reading",
    body: [
      "Each listing line is one instruction: a mnemonic, then operands separated by commas. The mnemonic names the operation.",
      "Arithmetic writes to its first operand. addiu $v0,$a0,0x5 reads $a0, adds 5, and writes the sum to $v0. move $v0,$a0 copies $a0 into $v0.",
      "A load also writes to its first operand. lw $v0,0x8($a0) reads memory at the address in $a0 plus 8 and writes the value to $v0.",
      "A store reads from its first operand. sw $a1,0x0($a0) and sb $a1,0x0($a0) write the value in $a1 to memory at the address in $a0. No register changes.",
      "A jump names where to go. jr $ra jumps to the address held in $ra.",
      "A test writes to its first operand, like arithmetic. slt $v0,$a0,$a1 asks whether $a0 is less than $a1 and writes 1 or 0 to $v0. The order of the two source operands is the order of the question.",
      "A branch writes nothing. It reads one or two registers and ends with a distance: bnez $v0,.+12 reads $v0 and, when it is not zero, continues three rows further down. A negative distance goes up: bgtz $a0,.-4 goes back one row while $a0 is above zero.",
      "j reads nothing and writes nothing. Its one operand is where to go, and in a mission's target it shows 0x0 because the linker has not filled it in; the comparison names the destination instead.",
    ],
  },
  {
    id: "orientation.activity",
    section: "ORIENTATION",
    title: "What you are doing",
    body: [
      "A game ships as machine code: the numbers a processor runs. The C source it was built from is gone.",
      "Matching decompilation writes new C that the original compiler turns into exactly the same machine code. Each mission shows a target function's instructions. You write C until your compiled instructions are identical.",
      "Exact output matters because the mgs_reversing project rebuilds the whole game from recovered C and checks that the result is byte-for-byte the original. Code that only behaves the same does not pass that check.",
    ],
  },
  {
    id: "orientation.success",
    section: "ORIENTATION",
    title: "What an exact match proves",
    body: [
      "An exact match proves that your C compiles to the same instructions as the target. It does not prove that your C is the text the original programmers wrote.",
      "Different C can compile to the same instructions. In mission 004, return a << 3; and return a * 8; both match, because the compiler turns multiplying by 8 into a shift by 3.",
      "Any matching source is a correct answer. When a match needs a particular spelling, the mission teaches why.",
    ],
  },
  {
    id: "orientation.machine",
    section: "ORIENTATION",
    title: "The machine and its rules",
    body: [
      "The game is Metal Gear Solid for the original Sony PlayStation (PS1). Its processor runs the MIPS instruction set: a small list of simple operations on numbers.",
      "The calling convention, or ABI, is the agreement about where a function finds its arguments and leaves its return value. On this machine they travel in specific registers.",
      "PsyQ is the C compiler the game was built with, and ASPSX is its assembler. Each has habits of its own. For example, plain char is unsigned in PsyQ.",
      "Keep two kinds of rule apart. C rules hold for C everywhere. Target rules belong to MIPS, this ABI, PsyQ, or ASPSX. Missions say which kind a rule is.",
    ],
  },
  {
    id: "orientation.compile",
    section: "ORIENTATION",
    title: "What Compile does",
    body: [
      "Compile sends your C to the PsyQ compiler, which writes assembly. The ASPSX assembler turns the assembly into words: 32-bit numbers, one per instruction. OSP compares your words with the target's.",
      "Nothing runs. There is no program output and no test suite. The only question is whether the instructions are the same.",
      "Register and memory diagrams show made-up example values that explain what the instructions would do. They are not the result of running your source.",
    ],
  },
  {
    id: "orientation.c-functions",
    section: "ORIENTATION",
    title: "C functions for JavaScript developers",
    body: [
      "int add_five(int a) { return a + 5; } is like function addFive(a) { return a + 5; } in JavaScript, with types written in.",
      "Read it left to right. int is the return type: the function gives back an integer. add_five is the name. (int a) is the parameter list: one integer parameter named a. The braces hold the body, and return gives back a value.",
      "int return_path(void) has void in its parameter list. There, void means the function takes no parameters.",
      "void store(int *p) has void before its name. There, void means the function returns nothing. Later missions use both meanings.",
    ],
  },
  {
    id: "orientation.registers",
    section: "ORIENTATION",
    title: "Registers",
    body: [
      "A register is a named storage slot inside the processor. Each holds one 32-bit number. Instructions read and write registers because they are much faster to reach than memory.",
      "Register names start with $. $v0 carries a function's return value, $a0 through $a3 carry its first arguments, $ra holds the address to return to, and $zero always reads as 0.",
      "Registers are not C variables, and they are not memory. You never declare $v0 in C. The compiler decides which registers hold your values, following the ABI.",
    ],
  },
  {
    id: "orientation.reading-instructions",
    section: "ORIENTATION",
    title: "Reading an instruction",
    body: [
      "A listing line has a mnemonic, the operation's short name, then operands. For arithmetic, the first operand is the destination: the register that receives the result.",
      "Read addiu $v0,$zero,0x2A aloud as: add the constant 0x2A to $zero, which is 0, and put the result in $v0. It sets $v0 to 42.",
      "Read jr $ra as: jump to the address in $ra. That is how a function returns to its caller.",
      "The Instruction reading entry in the MIPS section lists the operand order for each family of instructions.",
    ],
  },
  {
    id: "orientation.hexadecimal",
    section: "ORIENTATION",
    title: "Hexadecimal",
    body: [
      "Listings write constants in hexadecimal, base 16. The prefix 0x marks a hexadecimal number. Digits run 0 to 9, then A to F for 10 to 15.",
      "0x2A is 2 sixteens plus 10 ones: 32 + 10 = 42.",
      "The Word column in the target listing numbers the instructions from 0, in order. Those numbers are positions, not values the function computes.",
    ],
  },
  {
    id: "orientation.prerequisites",
    section: "ORIENTATION",
    title: "What you need",
    body: [
      "You need to be comfortable reading and editing code in some language, such as JavaScript. You do not need to know C, assembly, or binary arithmetic.",
      "This orientation covers the C and machine vocabulary the first missions use. Each mission lists its terms, and every term has a GLOSSARY entry in the manual.",
      "The manual is always available. Search it from any mission, or browse all entries.",
    ],
  },
  {
    id: "tools.overview",
    section: "TOOLS",
    title: "Workspace tools",
    body: [
      "Manual is the concept reference: what an instruction, type, or rule means. Search it for any term. Try it first.",
      "Scan explains the target listing itself: notes on its instructions and example values for registers and memory.",
      "Hint gives progressive help for the current mission, one stage at a time. Opening hints is recorded, and the last stage reveals the solution, which completes without advancing your skills.",
      "History lists your earlier compiles for this mission, so you can return to an attempt that got closer.",
      "Context appears on missions that use headers or struct layouts. It shows the headers exactly as the compiler receives them, and a table of each named type's field offsets. Reading it is free and is not recorded as a hint, so open it before Hint when a mission asks you to choose fields.",
    ],
  },
  {
    id: "glossary.register",
    section: "GLOSSARY",
    title: "register",
    body: [
      "A named 32-bit storage slot inside the processor, such as $v0 or $a0. Not a C variable and not memory.",
    ],
  },
  {
    id: "glossary.v0",
    section: "GLOSSARY",
    title: "$v0",
    body: [
      "The register that carries a function's int or pointer return value. The compiler may also use it for intermediate values.",
    ],
  },
  {
    id: "glossary.ra",
    section: "GLOSSARY",
    title: "$ra",
    body: [
      "The return address register. It holds the address in the caller where execution continues after the function returns.",
    ],
  },
  {
    id: "glossary.zero",
    section: "GLOSSARY",
    title: "$zero",
    body: ["A register that always reads as 0. Writes to it are ignored."],
  },
  {
    id: "glossary.jr",
    section: "GLOSSARY",
    title: "jr",
    body: [
      "Jump register. jr $ra jumps to the address in $ra, which returns from the function. Its delay slot runs first.",
    ],
  },
  {
    id: "glossary.addiu",
    section: "GLOSSARY",
    title: "addiu",
    body: [
      "Add immediate. addiu $v0,$a0,0x5 writes $a0 plus 5 to $v0. The constant is 16 bits and sign-extended. The u means an overflow does not stop the program; it does not mean the constant is unsigned.",
    ],
  },
  {
    id: "glossary.instruction",
    section: "GLOSSARY",
    title: "instruction",
    body: [
      "One operation the processor performs, such as an add, a load, or a jump. Each is encoded as one 32-bit word.",
    ],
  },
  {
    id: "glossary.mnemonic",
    section: "GLOSSARY",
    title: "mnemonic",
    body: [
      "The short name of an instruction in a listing, such as addiu, lw, or jr.",
    ],
  },
  {
    id: "glossary.operand",
    section: "GLOSSARY",
    title: "operand",
    body: [
      "A register, constant, or memory location an instruction works on, written after the mnemonic. For arithmetic and loads, the first operand is the destination.",
    ],
  },
  {
    id: "glossary.immediate",
    section: "GLOSSARY",
    title: "immediate",
    body: [
      "A constant stored inside the instruction itself, such as the 0x5 in addiu $v0,$a0,0x5.",
    ],
  },
  {
    id: "glossary.hexadecimal",
    section: "GLOSSARY",
    title: "hexadecimal (0x)",
    body: [
      "Base 16, marked by the prefix 0x. Digits A to F stand for 10 to 15, so 0x2A is 2 × 16 + 10 = 42.",
    ],
  },
  {
    id: "glossary.word",
    section: "GLOSSARY",
    title: "word",
    body: [
      "A 32-bit value. Each instruction is one word, and an int is one word. The Word column in a listing numbers instructions from 0.",
    ],
  },
  {
    id: "glossary.byte",
    section: "GLOSSARY",
    title: "byte",
    body: ["8 bits. A word is 4 bytes. A char is 1 byte."],
  },
  {
    id: "glossary.address",
    section: "GLOSSARY",
    title: "address",
    body: [
      "A number that says where a value is in memory. A pointer holds an address.",
    ],
  },
  {
    id: "glossary.offset",
    section: "GLOSSARY",
    title: "offset",
    body: [
      "A distance in bytes from a base address. In lw $v0,0x8($a0), the offset is 8.",
    ],
  },
  {
    id: "glossary.delay-slot",
    section: "GLOSSARY",
    title: "delay slot",
    body: [
      "The instruction right after a jump or branch. It runs before the jump takes effect.",
    ],
  },
  {
    id: "glossary.nop",
    section: "GLOSSARY",
    title: "nop",
    body: [
      "No operation: an instruction that does nothing. The assembler inserts nops where the machine needs a gap.",
    ],
  },
  {
    id: "glossary.compiler",
    section: "GLOSSARY",
    title: "compiler",
    body: [
      "The program that translates C into assembly. OSP uses PsyQ, the compiler the game was built with.",
    ],
  },
  {
    id: "glossary.assembler",
    section: "GLOSSARY",
    title: "assembler",
    body: [
      "The program that turns assembly into words. OSP uses ASPSX, which also inserts some nops.",
    ],
  },
  {
    id: "glossary.sign-extension",
    section: "GLOSSARY",
    title: "sign extension",
    body: [
      "Widening a value by copying its top bit into the new bits, so a negative number stays negative. Zero extension fills the new bits with 0 instead.",
    ],
  },
  {
    id: "glossary.stack-frame",
    section: "GLOSSARY",
    title: "stack frame",
    body: [
      "Memory a function reserves while it runs, for values that do not fit in registers. The first missions do not use one.",
    ],
  },
  {
    id: "glossary.a0",
    section: "GLOSSARY",
    title: "$a0 to $a3",
    body: [
      "The argument registers. The first four int or pointer arguments arrive in $a0, $a1, $a2, and $a3, in order.",
    ],
  },
  {
    id: "glossary.move",
    section: "GLOSSARY",
    title: "move",
    body: [
      "Copy a register. move $v0,$a0 copies $a0 into $v0, its first operand. The source keeps its value.",
    ],
  },
  {
    id: "glossary.sll",
    section: "GLOSSARY",
    title: "sll",
    body: [
      "Shift left logical. sll $v0,$a0,3 writes $a0 shifted left by 3 bits to $v0, which multiplies by 8.",
    ],
  },
  {
    id: "glossary.lw",
    section: "GLOSSARY",
    title: "lw",
    body: [
      "Load word. lw $v0,0x8($a0) reads the 4 bytes at the address in $a0 plus 8 and writes them to $v0.",
    ],
  },
  {
    id: "glossary.sw",
    section: "GLOSSARY",
    title: "sw",
    body: [
      "Store word. sw $a1,0x0($a0) writes $a1 to the 4 bytes at the address in $a0. Its first operand is the source.",
    ],
  },
  {
    id: "glossary.lb",
    section: "GLOSSARY",
    title: "lb and lbu",
    body: [
      "Load byte. Both read 1 byte and widen it to 32 bits: lb by sign extension, lbu by zero extension.",
    ],
  },
  {
    id: "glossary.bit",
    section: "GLOSSARY",
    title: "bit",
    body: [
      "A single binary digit, 0 or 1. A byte is 8 bits, and a register or word is 32.",
    ],
  },
  {
    id: "glossary.pointer",
    section: "GLOSSARY",
    title: "pointer",
    body: [
      "A value that holds an address. int *p declares p as a pointer to an int, and *p reads the int there.",
    ],
  },
  {
    id: "glossary.struct",
    section: "GLOSSARY",
    title: "struct",
    body: [
      "A C type that places named fields at fixed offsets in memory. Unlike a JavaScript object, its fields and their types are fixed.",
    ],
  },
  {
    id: "glossary.void",
    section: "GLOSSARY",
    title: "void",
    body: [
      "As a return type, the function returns nothing. As a parameter list, (void), the function takes no arguments. void * is a different use: a generic pointer.",
    ],
  },
  {
    id: "glossary.array",
    section: "GLOSSARY",
    title: "array",
    body: [
      "A fixed number of values of one type stored back to back. int samples[4] is four ints, 16 bytes.",
    ],
  },
  {
    id: "glossary.element",
    section: "GLOSSARY",
    title: "element",
    body: [
      "One value in an array. samples[i] is element i, counting from 0, at i element sizes from the start.",
    ],
  },
  {
    id: "glossary.embedded-struct",
    section: "GLOSSARY",
    title: "embedded struct",
    body: [
      "A struct stored inside another struct, reached with a dot. A pointer field, reached with ->, holds the address of a struct stored elsewhere.",
    ],
  },
  {
    id: "glossary.short",
    section: "GLOSSARY",
    title: "short",
    body: [
      "A 16-bit integer type, 2 bytes on this target. It holds -32768 to 32767.",
    ],
  },
  {
    id: "glossary.lh",
    section: "GLOSSARY",
    title: "lh and lhu",
    body: [
      "Load half: read 16 bits from memory. lh sign-extends them to 32 bits, and lhu zero-extends them.",
    ],
  },
  {
    id: "glossary.padding",
    section: "GLOSSARY",
    title: "padding",
    body: [
      "Unused bytes in a struct that move the next field to an offset matching its alignment.",
    ],
  },
  {
    id: "glossary.alignment",
    section: "GLOSSARY",
    title: "alignment",
    body: [
      "The multiple a field's offset must be. On this target: 1 for char, 2 for short, 4 for int and pointers.",
    ],
  },
  {
    id: "glossary.typedef",
    section: "GLOSSARY",
    title: "typedef",
    body: [
      "Gives a type a new name. typedef struct { int kind; } Slot; lets you write Slot instead of the struct.",
    ],
  },
  {
    id: "glossary.header",
    section: "GLOSSARY",
    title: "header file",
    body: [
      "A file of shared declarations, usually ending in .h. #include pastes its text into the source before compiling.",
    ],
  },
  {
    id: "glossary.generic-pointer",
    section: "GLOSSARY",
    title: "void *",
    body: [
      "A generic pointer: it holds an address of any type. Unlike void as a return type, it is a real 4-byte value.",
    ],
  },
  {
    id: "glossary.temporary",
    section: "GLOSSARY",
    title: "temporary",
    body: [
      "A register holding a value partway through a calculation. A register's usual role, such as $v0 for return values, does not stop the compiler from using it this way.",
    ],
  },
  {
    id: "glossary.twos-complement",
    section: "GLOSSARY",
    title: "two's complement",
    body: [
      "How signed integers are stored: the top bit counts as negative. In a byte, 1111 1101 is -128 + 125 = -3.",
    ],
  },
  {
    id: "glossary.addu",
    section: "GLOSSARY",
    title: "addu",
    body: [
      "Add. addu $v0,$a0,$a1 writes the sum of two registers to a third. It carries no constant, unlike addiu. The u means an overflow does not stop the program.",
    ],
  },
  {
    id: "glossary.subu",
    section: "GLOSSARY",
    title: "subu",
    body: [
      "Subtract. subu $v0,$a0,$a1 writes the first register minus the second to a third. There is no subtract-immediate: subtracting a constant is an add of a negative one.",
    ],
  },
  {
    id: "glossary.and",
    section: "GLOSSARY",
    title: "and and andi",
    body: [
      "Bitwise and. andi $v0,$a0,0xFF keeps the bits of $a0 that the 16-bit constant also has, and clears the rest. and $v0,$a0,$a1 does the same between two registers, for a mask too wide to fit in the instruction.",
    ],
  },
  {
    id: "glossary.mask",
    section: "GLOSSARY",
    title: "mask",
    body: [
      "A constant chosen for its bit pattern rather than its size, used to keep some bits of a value and discard the others. 0xFF is a mask for the low 8 bits.",
    ],
  },
  {
    id: "glossary.v1",
    section: "GLOSSARY",
    title: "$v1",
    body: [
      "The second result register. A function that returns one integer does not need it, so the compiler is free to use it for an intermediate value.",
    ],
  },
  {
    id: "glossary.sb",
    section: "GLOSSARY",
    title: "sb and sh",
    body: [
      "Narrow stores. sb writes the low 1 byte of a register to memory and sh writes the low 2. Neither has a signed and unsigned form, because a store only writes bits.",
    ],
  },
  {
    id: "glossary.halfword",
    section: "GLOSSARY",
    title: "halfword",
    body: ["Two bytes, 16 bits: the width of a short. Half of a word."],
  },
  {
    id: "glossary.sra",
    section: "GLOSSARY",
    title: "sra and srl",
    body: [
      "Right shifts. srl fills the vacated top bits with zeros. sra copies the sign bit into them instead, so a negative value stays negative. A signed value shifts with sra and an unsigned one with srl.",
    ],
  },
  {
    id: "glossary.global",
    section: "GLOSSARY",
    title: "global variable",
    body: [
      "A variable declared outside every function. It exists for the whole run at one fixed address, and nothing has to pass it in.",
    ],
  },
  {
    id: "glossary.lui",
    section: "GLOSSARY",
    title: "lui",
    body: [
      "Load upper immediate. It puts a 16-bit constant into the top half of a register and zeros the bottom, which is how a full 32-bit address or constant gets built from instructions that only carry 16 bits.",
    ],
  },
  {
    id: "glossary.relocation",
    section: "GLOSSARY",
    title: "relocation",
    body: [
      "A note that a constant in an instruction is not final. The compiler leaves the field zero and records which symbol it refers to; the linker fills it in once it has placed everything. The comparison checks the symbol, not the zeros.",
    ],
  },
  {
    id: "glossary.psyq",
    section: "GLOSSARY",
    title: "PsyQ",
    body: [
      "The PlayStation development kit whose C compiler built the game. Some rules, such as plain char being unsigned, are PsyQ behavior rather than rules of all C.",
    ],
  },
  {
    id: "glossary.slt",
    section: "GLOSSARY",
    title: "slt and sltu",
    body: [
      "Set on less than. slt writes 1 into its first operand when the second is less than the third, and 0 otherwise. sltu asks the same question reading both values as unsigned. slti and sltiu compare against a constant instead of a register.",
    ],
  },
  {
    id: "glossary.xor",
    section: "GLOSSARY",
    title: "xor and xori",
    body: [
      "Exclusive or. Each result bit is 1 when the two source bits differ. Two equal values give zero, which is how equality is tested, and xori against 1 flips the low bit, which is how an answer of 1 or 0 is reversed.",
    ],
  },
  {
    id: "glossary.nor",
    section: "GLOSSARY",
    title: "nor",
    body: [
      "Or, then invert. nor $v0,$zero,$a0 ors a value with nothing and inverts the result, so every bit flips. The sign bit of the result is the opposite of the original's.",
    ],
  },
  {
    id: "glossary.condition",
    section: "GLOSSARY",
    title: "condition",
    body: [
      "A question with a yes or no answer, such as a < b. In C its value is the number 1 or the number 0, so it can be returned or stored like any other value.",
    ],
  },
  {
    id: "glossary.beq",
    section: "GLOSSARY",
    title: "beq and bne",
    body: [
      "Branch on equal and branch on not equal. Each reads two registers and skips forward when they match, or when they do not. Compared against zero they are written beqz and bnez.",
    ],
  },
  {
    id: "glossary.bltz",
    section: "GLOSSARY",
    title: "bltz, blez, bgtz and bgez",
    body: [
      "Branches that read one register against zero: below zero, at most zero, above zero, and at least zero. No separate test instruction is needed for these four questions.",
    ],
  },
  {
    id: "glossary.displacement",
    section: "GLOSSARY",
    title: "branch displacement",
    body: [
      "The number a branch ends with. It is a distance in bytes from the branch's own row, not an address, so divide by 4 to count rows. The listing writes it in decimal.",
    ],
  },
  {
    id: "glossary.path",
    section: "GLOSSARY",
    title: "path",
    body: [
      "A run of instructions that executes together. A branch splits a listing into paths, and only one of them runs on any particular call.",
    ],
  },
  {
    id: "glossary.loop",
    section: "GLOSSARY",
    title: "loop",
    body: [
      "Rows that run again and again until a question is answered no. In a listing it is a branch with a negative distance, at the bottom of the rows it repeats.",
    ],
  },
  {
    id: "glossary.guard",
    section: "GLOSSARY",
    title: "guard",
    body: [
      "The branch in front of a while or for loop. It asks the opposite of the loop's question and skips the loop entirely when the body should not run even once.",
    ],
  },
  {
    id: "glossary.back-edge",
    section: "GLOSSARY",
    title: "back edge",
    body: [
      "The branch at the bottom of a loop that goes back up. Its delay slot runs on every pass, including the one after which the loop stops.",
    ],
  },
  {
    id: "glossary.j",
    section: "GLOSSARY",
    title: "j",
    body: [
      "Jump. It always goes, with no question asked, to a destination written into the instruction. The linker fills that destination in, so before linking it reads 0x0.",
    ],
  },
];
