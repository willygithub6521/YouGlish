/**
 * Elasticsearch index mappings and settings for the subtitles index
 */

export interface SubtitleDocument {
  subtitle_id: number;
  video_id: string;
  text: string;
  start_time: number;
  end_time: number;
  accent: string;
}

/**
 * Subtitles index mapping configuration
 * Based on the design document specifications
 */
export const subtitlesIndexMapping = {
  mappings: {
    properties: {
      subtitle_id: { 
        type: 'keyword' as const
      },
      video_id: { 
        type: 'keyword' as const
      },
      text: {
        type: 'text' as const,
        analyzer: 'english',
        fields: {
          exact: {
            type: 'text' as const,
            analyzer: 'standard'
          }
        }
      },
      start_time: { 
        type: 'float' as const
      },
      end_time: { 
        type: 'float' as const
      },
      accent: { 
        type: 'keyword' as const
      }
    }
  },
  settings: {
    number_of_shards: 3,
    number_of_replicas: 1,
    analysis: {
      analyzer: {
        english: {
          type: 'standard',
          stopwords: '_english_'
        }
      }
    },
    // Performance optimizations
    refresh_interval: '30s',
    max_result_window: 50000,
    // Memory optimizations
    'index.mapping.total_fields.limit': 1000,
    'index.mapping.depth.limit': 20
  }
};

/**
 * Index template for subtitles indices
 * Allows for multiple indices with consistent mapping
 */
export const subtitlesIndexTemplate = {
  index_patterns: ['youtube_pronunciation_subtitles*'],
  template: {
    ...subtitlesIndexMapping,
    aliases: {
      'subtitles_search': {}
    }
  },
  priority: 100,
  version: 1,
  _meta: {
    description: 'Template for YouTube pronunciation search subtitles indices',
    created_by: 'youtube-pronunciation-search-platform',
    created_at: new Date().toISOString()
  }
};

/**
 * Search query templates for common search patterns
 */
export const searchQueryTemplates = {
  /**
   * Fuzzy search with accent filtering
   */
  fuzzySearchWithAccent: {
    query: {
      bool: {
        must: [
          {
            multi_match: {
              query: '{{query}}',
              fields: ['text^2', 'text.exact'],
              type: 'best_fields',
              fuzziness: 'AUTO',
              prefix_length: 1,
              max_expansions: 50
            }
          }
        ],
        filter: [
          {
            term: {
              accent: '{{accent}}'
            }
          }
        ]
      }
    },
    highlight: {
      fields: {
        text: {
          pre_tags: ['<mark>'],
          post_tags: ['</mark>'],
          fragment_size: 150,
          number_of_fragments: 1
        }
      }
    },
    sort: [
      '_score',
      {
        start_time: {
          order: 'asc'
        }
      }
    ]
  },

  /**
   * Exact phrase search
   */
  exactPhraseSearch: {
    query: {
      bool: {
        must: [
          {
            match_phrase: {
              'text.exact': '{{query}}'
            }
          }
        ],
        filter: '{{accent_filter}}'
      }
    },
    highlight: {
      fields: {
        text: {
          pre_tags: ['<mark>'],
          post_tags: ['</mark>'],
          type: 'phrase'
        }
      }
    }
  },

  /**
   * Multi-field search with boosting
   */
  multiFieldSearch: {
    query: {
      bool: {
        should: [
          {
            match: {
              text: {
                query: '{{query}}',
                boost: 2.0,
                analyzer: 'english'
              }
            }
          },
          {
            match: {
              'text.exact': {
                query: '{{query}}',
                boost: 1.5,
                analyzer: 'standard'
              }
            }
          },
          {
            match_phrase: {
              text: {
                query: '{{query}}',
                boost: 3.0
              }
            }
          }
        ],
        minimum_should_match: 1,
        filter: '{{filters}}'
      }
    }
  }
};

/**
 * Aggregation queries for accent counting and statistics
 */
export const aggregationQueries = {
  /**
   * Count results by accent
   */
  accentCounts: {
    aggs: {
      accent_counts: {
        terms: {
          field: 'accent',
          size: 10
        }
      }
    }
  },

  /**
   * Video statistics
   */
  videoStats: {
    aggs: {
      unique_videos: {
        cardinality: {
          field: 'video_id'
        }
      },
      avg_duration: {
        avg: {
          script: {
            source: 'doc["end_time"].value - doc["start_time"].value'
          }
        }
      }
    }
  }
};

/**
 * Index lifecycle management policy
 */
export const indexLifecyclePolicy = {
  policy: {
    phases: {
      hot: {
        actions: {
          rollover: {
            max_size: '10GB',
            max_age: '30d'
          },
          set_priority: {
            priority: 100
          }
        }
      },
      warm: {
        min_age: '30d',
        actions: {
          set_priority: {
            priority: 50
          },
          allocate: {
            number_of_replicas: 0
          }
        }
      },
      cold: {
        min_age: '90d',
        actions: {
          set_priority: {
            priority: 0
          }
        }
      },
      delete: {
        min_age: '365d'
      }
    }
  }
};