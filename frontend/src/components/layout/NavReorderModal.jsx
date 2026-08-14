import { useState } from "react";
import { X, RotateCcw, GripVertical, Eye, EyeOff } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { cn } from "../../lib/utils";

export default function NavReorderModal({ open, items, onSave, onCancel, defaultItems }) {
  const [localItems, setLocalItems] = useState(items);

  if (!open) return null;

  const resetToDefault = () => {
    setLocalItems(defaultItems);
  };

  const toggleVisibility = (id) => {
    setLocalItems(current => current.map(item => item.id === id ? { ...item, hidden: !item.hidden } : item));
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
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-lg mx-4 flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Customize Navigation</h2>
            <p className="text-xs text-gray-500 mt-0.5">Reorder items or hide features you don't use.</p>
          </div>
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

                  return (
                    <Draggable key={item.id} draggableId={item.id} index={index}>
                      {(dragProvided, snapshot) => (
                        <div
                          ref={dragProvided.innerRef}
                          {...dragProvided.draggableProps}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2 rounded-md bg-gray-800/50 border border-gray-800 select-none",
                            item.hidden && "opacity-50",
                            snapshot.isDragging && "opacity-80 scale-[1.02] shadow-lg border-orange-500/40 bg-gray-800"
                          )}
                          style={{
                            ...dragProvided.draggableProps.style,
                            // Constrain drag to vertical only
                          }}
                        >
                          {/* Most of the row is the drag handle; visibility stays clickable. */}
                          <div
                            {...dragProvided.dragHandleProps}
                            className="flex flex-1 min-w-0 items-center gap-3 cursor-grab active:cursor-grabbing py-0.5"
                            title={`Drag ${item.label} to reorder`}
                          >
                            <GripVertical size={15} className="text-gray-500 shrink-0" />
                            <Icon size={14} className="text-gray-400 shrink-0" />
                            <span className="text-sm text-gray-300 truncate">{item.label}</span>
                          </div>
                          <button
                            onClick={() => toggleVisibility(item.id)}
                            title={item.hidden ? `Show ${item.label}` : `Hide ${item.label}`}
                            aria-label={item.hidden ? `Show ${item.label}` : `Hide ${item.label}`}
                            className={cn(
                              "p-1 rounded transition-colors",
                              item.hidden ? "text-gray-600 hover:text-orange-400" : "text-gray-400 hover:text-white hover:bg-gray-700"
                            )}
                          >
                            {item.hidden ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
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
