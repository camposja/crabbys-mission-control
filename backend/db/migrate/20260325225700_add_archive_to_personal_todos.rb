class AddArchiveToPersonalTodos < ActiveRecord::Migration[8.1]
  def change
    add_column :personal_todos, :completed_at, :datetime
    add_column :personal_todos, :archived, :boolean, default: false, null: false
    add_column :personal_todos, :archived_at, :datetime

    # Backfill completed_at for existing done items
    reversible do |dir|
      dir.up do
        execute "UPDATE personal_todos SET completed_at = updated_at WHERE done = true"
      end
    end
  end
end
