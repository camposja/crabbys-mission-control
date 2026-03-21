class CreateDocuments < ActiveRecord::Migration[8.1]
  def change
    create_table :documents do |t|
      t.string :title
      t.string :path
      t.text :content
      t.string :doc_type
      t.string :agent_id
      t.integer :project_id
      t.jsonb :metadata

      t.timestamps
    end
  end
end
