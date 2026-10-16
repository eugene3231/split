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

**Tip**:
An amount the group adds on top of the printed total, usually a percent of the bill before tax. It is shared in proportion to what each person had, and is left out when checking a receipt against its printed total.
_Avoid_: Gratuity, which on a receipt is a service charge

**Unassigned item**:
A receipt item that has no currently valid person selected for its assignment, or still has an unassigned share.
_Avoid_: Orphan item, missing split
