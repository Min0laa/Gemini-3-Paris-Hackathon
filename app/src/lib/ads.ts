export interface Ad {
  id: string;
  brand: string;
  logo: string;
  tagline: string;
  description: string;
  relevanceScore: number;
}

/**
 * Returns ads matched to the video topic.
 * TODO: replace with real Google Ads API call.
 */
export function getMatchedAds(_videoTopic: string): Ad[] {
  return [
    {
      id: "ad_1",
      brand: "Notion",
      logo: "📝",
      tagline: "Your second brain",
      description: "All-in-one workspace for notes, projects, and wikis.",
      relevanceScore: 94,
    },
    {
      id: "ad_2",
      brand: "Squarespace",
      logo: "🌐",
      tagline: "Build it beautiful",
      description: "Create a professional website in minutes.",
      relevanceScore: 87,
    },
    {
      id: "ad_3",
      brand: "NordVPN",
      logo: "🔒",
      tagline: "Stay private online",
      description: "The world's leading VPN service.",
      relevanceScore: 81,
    },
    {
      id: "ad_4",
      brand: "Skillshare",
      logo: "🎓",
      tagline: "Unlock your creativity",
      description: "Thousands of classes for curious people.",
      relevanceScore: 76,
    },
  ];
}
