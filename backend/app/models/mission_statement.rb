class MissionStatement < ApplicationRecord
  validates :content, presence: true

  def self.current
    order(created_at: :desc).first
  end
end
