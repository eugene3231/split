import type { EditableItem, Person } from '../../../../shared/types'
import type { ItemsSubPhase } from '../../types'
import { SimpleAssignPhase } from './SimpleAssignPhase'
import { SimpleReviewPhase } from './SimpleReviewPhase'

type Props = {
  items: EditableItem[]
  people: Person[]
  itemsSubPhase: ItemsSubPhase
  activeItemIndex: number
  onActiveItemIndexChange: (index: number) => void
  onItemsSubPhaseChange: (phase: ItemsSubPhase) => void
  onUpdateItem: (id: string, updater: (current: EditableItem) => EditableItem) => void
}

export function SimpleStepItems({
  items,
  people,
  itemsSubPhase,
  activeItemIndex,
  onActiveItemIndexChange,
  onItemsSubPhaseChange,
  onUpdateItem,
}: Props) {
  return (
    <div className="space-y-4">
      <h2 className="text-base font-bold text-slate-100">Assign Items</h2>

      {itemsSubPhase === 'assign' ? (
        <SimpleAssignPhase
          items={items}
          people={people}
          activeItemIndex={activeItemIndex}
          onUpdateItem={onUpdateItem}
          onPrevItem={() => onActiveItemIndexChange(Math.max(0, activeItemIndex - 1))}
          onNextItem={() => onActiveItemIndexChange(Math.min(items.length - 1, activeItemIndex + 1))}
          onGoToReview={() => onItemsSubPhaseChange('review')}
        />
      ) : (
        <SimpleReviewPhase
          items={items}
          people={people}
          onEditItem={(index) => {
            onActiveItemIndexChange(index)
            onItemsSubPhaseChange('assign')
          }}
        />
      )}
    </div>
  )
}
