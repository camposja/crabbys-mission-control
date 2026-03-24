import { useState, useEffect } from "react";
import { X, ChevronUp, ChevronDown, RotateCcw, GripVertical } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { cn } from "../../lib/utils";

export default function NavReorderModal({ open, items, onSave, onCancel, defaultItems }) {
  const [localItems, setLocalItems] = useState(items);

  // Sync local state when modal opens or items change
  useEffect(() => {
    if (open) {
      setLocalItems(items);
    }
  }, [open, items]);

  if (!open) return null;

  const moveUp = (index) => {
    if (index === 0) return;
    const next = [...localItems];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    setLocalItems(next);
  };

  const moveDown = (index) => {
    if (index === localItems.length - 1) return;
    const next = [...localItems];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    setLocalItems(next);
  };

  const resetToDefault = () => {
    setLocalItems(defaultItems);
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    const srcIdx = result.source.index;
    const destIdx = result.destination.index;
    if (srcIdx === destIdx) return;

    const next = [...localItems];
    const [moved] = next.splice(srcIdx, 1);
    next.splice(destIdx, 0, moved);
    setLocalItems(next);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-md mx-4 flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Customize Navigation Order</h2>
          <button
            onClick={onCancel}
            className="text-gray-500 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="nav-items">
            {(provided) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5"
              >
                {localItems.map((item, index) => {
                  const Icon = item.icon;
                  const isFirst = index === 0;
                  const isLast = index === localItems.length - 1;

                  return (
                    <Draggable key={item.id} draggableId={item.id} index={index}>
                      {(dragProvided, snapshot) => (
                        <div
                          ref={dragProvided.innerRef}
                          {...dragProvided.draggableProps}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2 rounded-md bg-gray-800/50 border border-gray-800 select-none",
                            snapshot.isDragging && "opacity-80 scale-[1.02] shadow-lg border-orange-500/40 bg-gray-800"
                          )}
                          style={{
                            ...dragProvided.draggableProps.style,
                            // Constrain drag to vertical only
                          }}
                        >
                          {/* Drag handle */}
                          <span
                            {...dragProvided.dragHandleProps}
                            className="text-gray-600 cursor-grab active:cursor-grabbing shrink-0"
                          >
                            <GripVertical size={14} />
                          </span>

                          <Icon size={14} className="text-gray-400 shrink-0" />
                          <span className="text-sm text-gray-300 flex-1 truncate">{item.label}</span>
                          <div className="flex items-center gap-0.5">
                            <button
                              onClick={() => moveUp(index)}
                              disabled={isFirst}
                              className={cn(
                                "p-1 rounded transition-colors",
                                isFirst
                                  ? "text-gray-700 cursor-not-allowed"
                                  : "text-gray-500 hover:text-white hover:bg-gray-700"
                              )}
                            >
                              <ChevronUp size={14} />
                            </button>
                            <button
                              onClick={() => moveDown(index)}
                              disabled={isLast}
                              className={cn(
                                "p-1 rounded transition-colors",
                                isLast
                                  ? "text-gray-700 cursor-not-allowed"
                                  : "text-gray-500 hover:text-white hover:bg-gray-700"
                              )}
                            >
                              <ChevronDown size={14} />
                            </button>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-800 flex items-center justify-between gap-3">
          <button
            onClick={resetToDefault}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-white transition-colors"
          >
            <RotateCcw size={12} />
            Reset to Default
          </button>

          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="text-sm px-4 py-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => onSave(localItems)}
              className="text-sm px-4 py-2 rounded-md font-medium bg-orange-500 hover:bg-orange-600 text-white transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
