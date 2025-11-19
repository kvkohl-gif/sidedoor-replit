import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Edit, Save, X } from "lucide-react";

interface InlineNotesProps {
  notes: string;
  onSave: (notes: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function InlineNotes({ notes, onSave, placeholder = "Add notes...", disabled = false }: InlineNotesProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(notes);

  const handleSave = () => {
    onSave(editValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(notes);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="space-y-2">
        <Textarea
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          placeholder={placeholder}
          className="min-h-20 text-sm"
          autoFocus
        />
        <div className="flex items-center space-x-2">
          <Button size="sm" onClick={handleSave}>
            <Save className="w-4 h-4 mr-1" />
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={handleCancel}>
            <X className="w-4 h-4 mr-1" />
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="group">
      {notes ? (
        <div className="flex items-start space-x-2">
          <p className="text-sm text-slate-600 flex-1">{notes}</p>
          {!disabled && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsEditing(true)}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Edit className="w-3 h-3" />
            </Button>
          )}
        </div>
      ) : (
        !disabled && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsEditing(true)}
            className="text-slate-400 hover:text-slate-600"
          >
            <Edit className="w-4 h-4 mr-1" />
            {placeholder}
          </Button>
        )
      )}
    </div>
  );
}