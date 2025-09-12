# Onboarding Form Field Mapping

This document maps all onboarding form fields to the database schema.

## Step 1: Business Description
| Form Field | Database Column | Type | Description |
|------------|----------------|------|-------------|
| business_name | business_name | text | Business name |
| business_type | business_type | text[] | Array of business types |
| industry | industry | text[] | Array of industries |
| business_description | business_description | text | Business description |
| unique_value_proposition | unique_value_proposition | text | Unique value proposition |
| target_audience | target_audience | text[] | General target audience |
| target_audience_age_groups | target_audience_age_groups | text[] | Age group targeting |
| target_audience_life_stages | target_audience_life_stages | text[] | Life stage targeting |
| target_audience_professional_types | target_audience_professional_types | text[] | Professional type targeting |
| target_audience_lifestyle_interests | target_audience_lifestyle_interests | text[] | Lifestyle interests |
| target_audience_buyer_behavior | target_audience_buyer_behavior | text[] | Buyer behavior patterns |
| target_audience_other | target_audience_other | text | Other target audience input |

## Step 2: Brand & Contact Information
| Form Field | Database Column | Type | Description |
|------------|----------------|------|-------------|
| brand_voice | brand_voice | text | Brand voice description |
| brand_tone | brand_tone | text | Brand tone description |
| website_url | website_url | text | Website URL |
| phone_number | phone_number | text | Phone number |
| street_address | street_address | text | Street address |
| city | city | text | City |
| state | state | text | State/Province |
| country | country | text | Country |
| timezone | timezone | text | User timezone |

## Step 3: Current Presence & Focus Areas
| Form Field | Database Column | Type | Description |
|------------|----------------|------|-------------|
| current_presence | current_presence | text[] | Current online presence |
| focus_areas | focus_areas | text[] | Focus areas for marketing |
| platform_details | platform_details | jsonb | Platform-specific details |
| facebook_page_name | facebook_page_name | text | Facebook page name |
| instagram_profile_link | instagram_profile_link | text | Instagram profile link |
| linkedin_company_link | linkedin_company_link | text | LinkedIn company link |
| youtube_channel_link | youtube_channel_link | text | YouTube channel link |
| x_twitter_profile | x_twitter_profile | text | X/Twitter profile |
| google_business_profile | google_business_profile | text | Google Business Profile |
| google_ads_account | google_ads_account | text | Google Ads account |
| whatsapp_business | whatsapp_business | text | WhatsApp Business |
| email_marketing_platform | email_marketing_platform | text | Email marketing platform |
| meta_ads_accounts | meta_ads_accounts | text | Meta Ads accounts |
| current_presence_other | current_presence_other | text | Other presence input |

## Step 4: Goals & Metrics
| Form Field | Database Column | Type | Description |
|------------|----------------|------|-------------|
| primary_goals | primary_goals | text[] | Primary marketing goals |
| key_metrics_to_track | key_metrics_to_track | text[] | Key metrics to track |
| goal_other | goal_other | text | Other goal input |
| metric_other | metric_other | text | Other metric input |

## Step 5: Budget & Content Strategy
| Form Field | Database Column | Type | Description |
|------------|----------------|------|-------------|
| monthly_budget_range | monthly_budget_range | text | Monthly budget range |
| posting_frequency | posting_frequency | text | Posting frequency |
| preferred_content_types | preferred_content_types | text[] | Preferred content types |
| content_themes | content_themes | text[] | Content themes |
| content_type_other | content_type_other | text | Other content type input |
| content_theme_other | content_theme_other | text | Other content theme input |

## Step 6: Market Analysis
| Form Field | Database Column | Type | Description |
|------------|----------------|------|-------------|
| main_competitors | main_competitors | text | Main competitors |
| market_position | market_position | text | Market position |
| products_or_services | products_or_services | text | Products or services |

## Step 7: Campaign Planning
| Form Field | Database Column | Type | Description |
|------------|----------------|------|-------------|
| important_launch_dates | important_launch_dates | text | Important launch dates |
| planned_promotions_or_campaigns | planned_promotions_or_campaigns | text | Planned promotions/campaigns |
| top_performing_content_types | top_performing_content_types | text[] | Top performing content types |
| best_time_to_post | best_time_to_post | text[] | Best time to post |
| top_performing_content_type_other | top_performing_content_type_other | text | Other content type input |
| posting_time_other | posting_time_other | text | Other posting time input |

## Step 8: Performance & Customer
| Form Field | Database Column | Type | Description |
|------------|----------------|------|-------------|
| successful_campaigns | successful_campaigns | text | Successful campaigns |
| hashtags_that_work_well | hashtags_that_work_well | text | Working hashtags |
| customer_pain_points | customer_pain_points | text | Customer pain points |
| typical_customer_journey | typical_customer_journey | text | Typical customer journey |

## Step 9: Automation & Platform
| Form Field | Database Column | Type | Description |
|------------|----------------|------|-------------|
| automation_level | automation_level | text | Automation level |
| social_media_platforms | social_media_platforms | text[] | Social media platforms |
| platform_specific_tone | platform_specific_tone | jsonb | Platform-specific tone settings |
| platform_tone_instagram | platform_tone_instagram | text[] | Instagram tone preferences |
| platform_tone_facebook | platform_tone_facebook | text[] | Facebook tone preferences |
| platform_tone_linkedin | platform_tone_linkedin | text[] | LinkedIn tone preferences |
| platform_tone_youtube | platform_tone_youtube | text[] | YouTube tone preferences |
| platform_tone_x | platform_tone_x | text[] | X/Twitter tone preferences |

## Other Input Fields
| Form Field | Database Column | Type | Description |
|------------|----------------|------|-------------|
| business_type_other | business_type_other | text | Other business type input |
| industry_other | industry_other | text | Other industry input |
| social_platform_other | social_platform_other | text | Other social platform input |

## JSON Fields
- **platform_details**: Stores platform-specific information like URLs, handles, etc.
- **platform_specific_tone**: Stores tone preferences for each platform

## Array Fields
All array fields store multiple selections as text arrays, allowing for flexible data storage and querying.
