### 1. Game Components

- **Total Tiles (26):**
- **13 White Tiles:** Numbers 1–12 plus one Joker (Zero "0").
- **13 Black Tiles:** Numbers 1–12 plus one Joker (Zero "0").

- **Player Setup:**
- **2 or 3 Players:** Each starts with **4 tiles**.
- **4 Players:** Each starts with **3 tiles**.
- Tiles are drawn randomly from the face-down pool.

### 2. Tile Placement Logic (The "Code")

- **Sorting Rule:** Tiles must be arranged in **ascending numerical order** from left to right.
- **Tie-breaker:** If a player has a black and white tile of the same number, the **Black tile** must be placed to the **left** of the White tile.
- **Joker Rule (Wildcard):**
- A Joker can be placed **anywhere** in the sequence (e.g., between a 2 and a 3, or at the very beginning/end).
- It does **not** have to follow numerical order.
- **Constraint:** Once a Joker is placed in the lineup, its position is **fixed** for the rest of the game and cannot be moved to a different slot.

### 3. The Turn Sequence

Each turn follows a strict state machine:

1. **Draw Phase:**

- Active player draws one tile from the pool.
- This tile is "In Hand" (hidden from others) and is **not** yet added to the lineup.

2. **Attack Phase (Guessing):**

- The player selects one hidden tile in an opponent's lineup.
- The player must declare both the **Color** (visible) and the **Value** (hidden).
- **To guess a Joker:** The player must specifically say, "This is a Black Joker" or "This is a White Joker."

3. **Outcome Phase:**

- **Success (Correct Guess):**
- The opponent reveals the tile (it stays face-up for the rest of the game).
- The active player chooses: **a) Attack again** (using the same "In Hand" tile) or **b) End Turn**.
- If the turn ends, the "In Hand" tile is placed **hidden** into the player's lineup according to the sorting rules.

- **Failure (Incorrect Guess):**
- The active player must reveal their "In Hand" tile.
- This tile is placed **face-up** (visible to all) in its correct position in the player's own lineup.
- The turn ends immediately.

### 4. Game States & Conditions

- **Hidden vs. Revealed:**
- Hidden tiles are only known to the owner.
- Revealed tiles are public knowledge and used for deduction.

- **Deduction Logic for Players:**
- Numbers are unique per color (only one "Black 5" exists).
- Jokers break the numerical chain, making adjacent tiles harder to guess.

- **Elimination:** A player is eliminated when all their tiles are revealed.
- **Win Condition:** The last player with any hidden tiles remaining wins.
