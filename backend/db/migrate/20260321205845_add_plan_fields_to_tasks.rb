class AddPlanFieldsToTasks < ActiveRecord::Migration[8.1]
  def change
    add_column :tasks, :plan_content, :text
    add_column :tasks, :plan_questions, :jsonb
    add_column :tasks, :plan_approved_at, :datetime
    add_column :tasks, :openclaw_agent_id, :string
    add_column :tasks, :agent_status, :string
    add_column :tasks, :state_changed_at, :datetime
  end
end
