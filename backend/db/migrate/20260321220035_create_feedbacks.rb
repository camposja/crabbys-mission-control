class CreateFeedbacks < ActiveRecord::Migration[8.1]
  def change
    create_table :feedbacks do |t|
      t.string :title
      t.text :description
      t.string :feedback_type
      t.string :status
      t.text :ai_response
      t.string :branch_name
      t.jsonb :metadata

      t.timestamps
    end
  end
end
