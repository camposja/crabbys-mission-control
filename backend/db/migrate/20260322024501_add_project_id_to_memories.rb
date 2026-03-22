class AddProjectIdToMemories < ActiveRecord::Migration[8.1]
  def change
    add_column :memories, :project_id, :integer
    add_index :memories, :project_id
    add_foreign_key :memories, :projects, column: :project_id, on_delete: :nullify
  end
end
