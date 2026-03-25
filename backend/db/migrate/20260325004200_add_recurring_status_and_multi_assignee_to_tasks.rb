class AddRecurringStatusAndMultiAssigneeToTasks < ActiveRecord::Migration[8.1]
  def change
    # Add assignees jsonb array for multi-assignment support.
    # Keep the old `assignee` column for backward compatibility during transition.
    add_column :tasks, :assignees, :jsonb, default: [], null: false

    # Migrate existing single assignee into the new assignees array
    reversible do |dir|
      dir.up do
        execute <<~SQL
          UPDATE tasks
          SET assignees = CASE
            WHEN assignee IS NOT NULL AND assignee != ''
            THEN jsonb_build_array(assignee)
            ELSE '[]'::jsonb
          END
        SQL
      end
    end
  end
end
