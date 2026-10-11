# Split

Split is a browser-only bill-splitting app for turning receipt items into each person's amount owed.

## Language

**Assignment**:
The decision that a receipt item belongs to one or more people in the split.
_Avoid_: Allocation, ownership

**Share weight**:
A positive whole-number share used to divide an assigned item unequally between selected people.
_Avoid_: Ratio, percentage

**Unassigned share**:
The part of an item's share weights that nobody has taken yet, such as the other half of an item one person had half of.
_Avoid_: Remainder, leftover weight

**Rounding**:
A fixed amount a store adds to reach its printed receipt total. It comes after tax and is split evenly between everyone with something on that receipt.
_Avoid_: Adjustment, top-up

**Unassigned item**:
A receipt item that has no currently valid person selected for its assignment, or still has an unassigned share.
_Avoid_: Orphan item, missing split
