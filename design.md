# YouTube 發音搜尋平台 - 設計文件

## 1. 概述

本設計文件描述了一個類似 YouGlish 的英語發音學習平台的技術架構與實作細節。該平台允許用戶搜尋英文單字或短語，並從真實的 YouTube 影片中找到該單字的發音範例，支援多種英語口音篩選和連續播放功能。

### 1.1 設計目標

- 提供快速、準確的單字發音搜尋體驗
- 支援多種英語口音的篩選和學習
- 提供流暢的影片播放和字幕同步體驗
- 建立可擴展的架構以支援未來功能擴展

### 1.2 技術棧概覽

**前端：**
- React 18+ with TypeScript
- Tailwind CSS
- React Query
- YouTube IFrame Player API

**後端：**
- Node.js 18+ with Express
- TypeScript
- RESTful API

**資料層：**
- PostgreSQL（結構化資料）
- Elasticsearch（全文搜尋）
- Redis（快取層）

**外部服務：**
- YouTube Data API v3
- YouTube Transcript API

## 2. 系統架構

### 2.1 整體架構

系統採用三層架構設計：

```
┌─────────────────────────────────────────────────────────┐
│                      前端層 (React)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │ 搜尋介面 │  │ 播放器   │  │ 字幕顯示 │  │ 篩選器  │ │
│  └──────────┘  └──────────┘  └──────────┘  └─────────┘ │
└─────────────────────────────────────────────────────────┘
                          │
                    HTTPS/REST API
                          │
┌─────────────────────────────────────────────────────────┐
│                    後端層 (Node.js)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │ API 路由 │  │ 搜尋服務 │  │ 影片服務 │  │ 快取層  │ │
│  └──────────┘  └──────────┘  └──────────┘  └─────────┘ │
└─────────────────────────────────────────────────────────┘
                          │
              ┌───────────┼───────────┐
              │           │           │
┌─────────────▼──┐  ┌────▼─────┐  ┌─▼──────┐
│   PostgreSQL   │  │Elasticsearch│  │ Redis  │
│  (影片元數據)  │  │ (全文搜尋) │  │(快取)  │
└────────────────┘  └───────────┘  └────────┘
```

### 2.2 資料流程

**搜尋流程：**
1. 用戶在前端輸入搜尋詞
2. 前端發送 API 請求到後端
3. 後端檢查 Redis 快取
4. 若快取未命中，查詢 Elasticsearch
5. Elasticsearch 返回匹配的字幕片段 ID
6. 從 PostgreSQL 獲取完整的影片和字幕資料
7. 結果快取到 Redis
8. 返回結果給前端

**播放流程：**
1. 前端接收搜尋結果（包含影片 ID 和時間戳）
2. 使用 YouTube IFrame API 載入影片
3. 自動跳轉到指定時間點
4. 同步顯示對應的字幕文本
5. 高亮顯示搜尋的單字

## 3. 元件設計

### 3.1 前端元件

#### 3.1.1 SearchBar 元件

**職責：** 處理用戶搜尋輸入和提交

**介面：**
```typescript
interface SearchBarProps {
  onSearch: (query: string) => void;
  isLoading: boolean;
  placeholder?: string;
}

interface SearchBarState {
  query: string;
  suggestions: string[];
}
```

**行為：**
- 接收用戶輸入
- 提供搜尋建議（可選）
- 觸發搜尋事件
- 顯示載入狀態

#### 3.1.2 AccentFilter 元件

**職責：** 提供口音篩選功能

**介面：**
```typescript
type Accent = 'ALL' | 'US' | 'UK' | 'AU' | 'CA' | 'OTHER';

interface AccentFilterProps {
  selectedAccent: Accent;
  onAccentChange: (accent: Accent) => void;
  resultCounts: Record<Accent, number>;
}
```

**行為：**
- 顯示可用的口音選項
- 顯示每個口音的結果數量
- 處理口音選擇變更

#### 3.1.3 VideoPlayer 元件

**職責：** 嵌入和控制 YouTube 影片播放

**介面：**
```typescript
interface VideoPlayerProps {
  videoId: string;
  startTime: number;
  onReady: () => void;
  onStateChange: (state: PlayerState) => void;
}

interface VideoPlayerMethods {
  play: () => void;
  pause: () => void;
  seekTo: (seconds: number) => void;
  getCurrentTime: () => number;
}
```

**行為：**
- 載入 YouTube IFrame Player
- 自動跳轉到指定時間
- 提供播放控制介面
- 發送播放狀態事件

#### 3.1.4 SubtitleDisplay 元件

**職責：** 顯示字幕並高亮搜尋詞

**介面：**
```typescript
interface SubtitleDisplayProps {
  text: string;
  highlightWords: string[];
  context: {
    before: string;
    after: string;
  };
}
```

**行為：**
- 渲染字幕文本
- 高亮顯示搜尋的單字
- 顯示上下文句子

#### 3.1.5 ResultNavigator 元件

**職責：** 控制結果導航和連續播放

**介面：**
```typescript
interface ResultNavigatorProps {
  currentIndex: number;
  totalResults: number;
  onPrevious: () => void;
  onNext: () => void;
  autoPlay: boolean;
  onAutoPlayToggle: (enabled: boolean) => void;
}
```

**行為：**
- 顯示當前結果位置（例如：1/50）
- 提供上一個/下一個按鈕
- 支援自動播放切換
- 處理鍵盤快捷鍵

### 3.2 後端服務

#### 3.2.1 SearchService

**職責：** 處理搜尋邏輯和結果排序

**介面：**
```typescript
interface SearchService {
  search(params: SearchParams): Promise<SearchResult[]>;
  getSuggestions(prefix: string): Promise<string[]>;
}

interface SearchParams {
  query: string;
  accent?: Accent;
  fuzzy?: boolean;
  limit?: number;
  offset?: number;
}

interface SearchResult {
  id: string;
  videoId: string;
  startTime: number;
  endTime: number;
  text: string;
  accent: Accent;
  relevanceScore: number;
}
```

**實作細節：**
- 使用 Elasticsearch 進行全文搜尋
- 支援模糊匹配和完全匹配
- 根據相關性評分排序結果
- 實作分頁功能

#### 3.2.2 VideoService

**職責：** 管理影片元數據和字幕

**介面：**
```typescript
interface VideoService {
  getVideoMetadata(videoId: string): Promise<VideoMetadata>;
  getSubtitles(videoId: string): Promise<Subtitle[]>;
  indexNewVideo(videoId: string): Promise<void>;
}

interface VideoMetadata {
  id: string;
  title: string;
  channelName: string;
  duration: number;
  accent: Accent;
  thumbnailUrl: string;
}

interface Subtitle {
  id: string;
  videoId: string;
  startTime: number;
  endTime: number;
  text: string;
}
```

**實作細節：**
- 從 YouTube Data API 獲取影片資訊
- 使用 YouTube Transcript API 獲取字幕
- 將字幕索引到 Elasticsearch
- 儲存元數據到 PostgreSQL

#### 3.2.3 CacheService

**職責：** 管理 Redis 快取層

**介面：**
```typescript
interface CacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  invalidate(pattern: string): Promise<void>;
}
```

**快取策略：**
- 搜尋結果快取：TTL 1 小時
- 影片元數據快取：TTL 24 小時
- 字幕資料快取：TTL 24 小時
- 使用 LRU 淘汰策略

## 4. API 設計

### 4.1 RESTful API 端點

#### 4.1.1 搜尋 API

**端點：** `GET /api/search`

**查詢參數：**
```typescript
{
  q: string;           // 搜尋詞（必填）
  accent?: Accent;     // 口音篩選
  fuzzy?: boolean;     // 模糊搜尋
  limit?: number;      // 結果數量（預設 20）
  offset?: number;     // 分頁偏移（預設 0）
}
```

**回應：**
```typescript
{
  results: SearchResult[];
  total: number;
  query: string;
  accent: Accent;
  accentCounts: Record<Accent, number>;
}
```

**狀態碼：**
- 200: 成功
- 400: 無效的查詢參數
- 500: 伺服器錯誤

#### 4.1.2 影片元數據 API

**端點：** `GET /api/videos/:videoId`

**回應：**
```typescript
{
  video: VideoMetadata;
  subtitles: Subtitle[];
}
```

**狀態碼：**
- 200: 成功
- 404: 影片不存在
- 500: 伺服器錯誤

#### 4.1.3 搜尋建議 API

**端點：** `GET /api/suggestions`

**查詢參數：**
```typescript
{
  prefix: string;      // 輸入前綴（必填）
  limit?: number;      // 建議數量（預設 10）
}
```

**回應：**
```typescript
{
  suggestions: string[];
}
```

### 4.2 錯誤回應格式

所有 API 錯誤回應遵循統一格式：

```typescript
{
  error: {
    code: string;
    message: string;
    details?: any;
  }
}
```

## 5. 資料模型

### 5.1 PostgreSQL 資料庫架構

#### 5.1.1 videos 表

```sql
CREATE TABLE videos (
  id VARCHAR(20) PRIMARY KEY,
  title TEXT NOT NULL,
  channel_name VARCHAR(255) NOT NULL,
  duration INTEGER NOT NULL,
  accent VARCHAR(10) NOT NULL,
  thumbnail_url TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_videos_accent ON videos(accent);
```

#### 5.1.2 subtitles 表

```sql
CREATE TABLE subtitles (
  id SERIAL PRIMARY KEY,
  video_id VARCHAR(20) NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  start_time DECIMAL(10, 3) NOT NULL,
  end_time DECIMAL(10, 3) NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_subtitles_video_id ON subtitles(video_id);
CREATE INDEX idx_subtitles_time ON subtitles(video_id, start_time);
```

### 5.2 Elasticsearch 索引架構

#### 5.2.1 subtitles 索引

```json
{
  "mappings": {
    "properties": {
      "subtitle_id": { "type": "keyword" },
      "video_id": { "type": "keyword" },
      "text": {
        "type": "text",
        "analyzer": "english",
        "fields": {
          "exact": {
            "type": "text",
            "analyzer": "standard"
          }
        }
      },
      "start_time": { "type": "float" },
      "end_time": { "type": "float" },
      "accent": { "type": "keyword" }
    }
  },
  "settings": {
    "number_of_shards": 3,
    "number_of_replicas": 1,
    "analysis": {
      "analyzer": {
        "english": {
          "type": "standard",
          "stopwords": "_english_"
        }
      }
    }
  }
}
```

### 5.3 Redis 快取鍵設計

```
search:{query}:{accent}:{offset}:{limit}  -> SearchResult[]
video:{videoId}:metadata                  -> VideoMetadata
video:{videoId}:subtitles                 -> Subtitle[]
suggestions:{prefix}                      -> string[]
```

### 5.4 TypeScript 型別定義

```typescript
// 口音類型
type Accent = 'ALL' | 'US' | 'UK' | 'AU' | 'CA' | 'OTHER';

// 影片元數據
interface VideoMetadata {
  id: string;
  title: string;
  channelName: string;
  duration: number;
  accent: Accent;
  thumbnailUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

// 字幕
interface Subtitle {
  id: number;
  videoId: string;
  startTime: number;
  endTime: number;
  text: string;
  createdAt: Date;
}

// 搜尋結果
interface SearchResult {
  id: string;
  videoId: string;
  startTime: number;
  endTime: number;
  text: string;
  accent: Accent;
  relevanceScore: number;
  context: {
    before: string;
    after: string;
  };
}

// 搜尋參數
interface SearchParams {
  query: string;
  accent?: Accent;
  fuzzy?: boolean;
  limit?: number;
  offset?: number;
}

// 搜尋回應
interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
  accent: Accent;
  accentCounts: Record<Accent, number>;
}

// 播放器狀態
enum PlayerState {
  UNSTARTED = -1,
  ENDED = 0,
  PLAYING = 1,
  PAUSED = 2,
  BUFFERING = 3,
  CUED = 5
}
```

