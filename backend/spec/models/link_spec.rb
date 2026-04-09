require 'rails_helper'

RSpec.describe Link, type: :model do
  # ── Associations ────────────────────────────────────────────────────────────
  it { is_expected.to belong_to(:project) }
  it { is_expected.to belong_to(:task).optional }

  # ── Validations ─────────────────────────────────────────────────────────────
  it { is_expected.to validate_presence_of(:url) }
  it { is_expected.to validate_presence_of(:project) }
  it { is_expected.to validate_inclusion_of(:source_type).in_array(Link::SOURCE_TYPES) }

  # ── Custom validation: task_belongs_to_project ──────────────────────────────
  describe "task_belongs_to_project" do
    it "is valid when task belongs to the same project" do
      link = build(:link, :with_task)
      expect(link).to be_valid
    end

    it "is invalid when task belongs to a different project" do
      other_project = create(:project)
      task = create(:task, project: other_project)
      link = build(:link, task: task) # link.project is a different project
      expect(link).not_to be_valid
      expect(link.errors[:task_id]).to include("must belong to the same project as the link")
    end

    it "is valid with no task" do
      link = build(:link, task: nil)
      expect(link).to be_valid
    end
  end

  # ── Callbacks ───────────────────────────────────────────────────────────────
  describe "#normalize_url" do
    it "strips whitespace from URL" do
      link = create(:link, url: "  https://example.com  ")
      expect(link.url).to eq("https://example.com")
    end
  end

  describe "#infer_source_type" do
    it "detects youtube.com" do
      link = create(:link, url: "https://youtube.com/watch?v=abc")
      expect(link.source_type).to eq("youtube")
    end

    it "detects youtu.be" do
      link = create(:link, url: "https://youtu.be/abc123")
      expect(link.source_type).to eq("youtube")
    end

    it "detects twitter.com" do
      link = create(:link, url: "https://twitter.com/user/status/1")
      expect(link.source_type).to eq("twitter")
    end

    it "detects x.com" do
      link = create(:link, url: "https://x.com/user/status/1")
      expect(link.source_type).to eq("twitter")
    end

    it "detects github.com" do
      link = create(:link, url: "https://github.com/owner/repo")
      expect(link.source_type).to eq("github")
    end

    it "defaults to other for unknown URLs" do
      link = create(:link, url: "https://random-site.org/page")
      expect(link.source_type).to eq("other")
    end

    it "does not overwrite an explicitly set source_type" do
      link = create(:link, url: "https://youtube.com/watch?v=abc", source_type: "docs")
      expect(link.source_type).to eq("docs")
    end
  end

  # ── Scopes ──────────────────────────────────────────────────────────────────
  describe ".recent_first" do
    it "returns links ordered by created_at descending" do
      old = create(:link, created_at: 2.days.ago)
      new_link = create(:link, created_at: 1.hour.ago)
      expect(Link.recent_first.first).to eq(new_link)
      expect(Link.recent_first.last).to eq(old)
    end
  end

  describe ".for_project" do
    it "filters by project_id" do
      project = create(:project)
      link = create(:link, project: project)
      _other = create(:link)
      expect(Link.for_project(project.id)).to eq([link])
    end
  end

  describe ".for_task" do
    it "filters by task_id" do
      link = create(:link, :with_task)
      _other = create(:link)
      expect(Link.for_task(link.task_id)).to eq([link])
    end
  end
end
