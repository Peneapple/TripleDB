# NAR Database Issue 网站界面参考与 TripleDB 信息架构

本文件记录了本原型所借鉴的成熟数据库网站模式。它不是对任何网站视觉设计的复制，而是对常见功能模块的归纳。

## 重点参考资源

### BioGRID

- 首页提供显著的 search entry，并区分 gene/protein、publication、chemical 等检索模式。
- 首页直接展示数据库版本和主要统计数字。
- 一级导航包含 help、projects、tools、contribute、statistics、downloads、partners 和 about。
- 独立 download repository 保存 current release 与 release archive。
- 对 TripleDB 最直接的启示：主检索、publication/source ID 追溯、统计、下载、版本归档和数据贡献入口应清楚分开。

### IntAct

- 检索结果同时支持 graph 和 table 表达。
- 有完整 filters、visualization options，以及 tabular/graphical export。
- 单条 interaction 具有细粒度 detail view。
- 首页通过 organism/dataset tiles 帮助用户在没有精确查询时进入数据。
- 提供 user guide、web services、bulk downloads 和定期 release。
- 对 TripleDB 的启示：第一版不必做复杂网络，但记录详情、过滤、导出和 evidence detail 是核心。

### STRING

- 首页支持多种输入场景，而不是只有一个单基因搜索。
- 核心结果是可交互网络，并附带 clustering、functional enrichment 和 export。
- Help 区包含 getting started、scores、use scenarios、FAQ 和 what's new。
- 提供 organism-specific downloads、API、versions、licensing 和 statistics。
- 对 TripleDB 的启示：搜索示例、use scenarios、API/下载并列，以及明确的版本入口能显著降低使用门槛。

### Reactome

- 首页把 Search、Pathway Browser、Analysis Tools、Documentation 等主要任务做成清晰入口。
- 数据浏览与分析分开，但互相连接。
- 提供 bulk download、Content Service API、Analysis Service、documentation、release news 和 citation guidance。
- 对 TripleDB 的启示：主页应突出 3–4 个最重要任务，documentation 不应藏在 footer；citation 和 release metadata 应标准化。

### NHGRI-EBI GWAS Catalog

- 首页搜索框提供多种真实输入示例。
- 导航包括 Diagram、Submit、Download、Learn、About 和 Blog。
- Learn 区集中 curation process、data sources、training、abbreviations、FAQ 和 API documentation。
- 首页展示数据库内容统计、genome assembly/dbSNP build 等关键版本元数据，并提供 feedback/known issues。
- 对 TripleDB 的启示：首页除记录总数外，还应显示 source BioGRID release；用户反馈和已知问题应有固定入口。

## TripleDB 建议的 MVP 页面

### 投稿前必须达到生产状态

1. Home：价值主张、单一主搜索、版本和数据新鲜度。
2. Search：gene/alias/TDB/BioGRID/PMID 检索、筛选和 bookmarkable query。
3. Record：稳定 URL、关系、角色、phenotype/condition、qualification、source IDs、PMID 和 history。
4. Source evidence：BioGRID ID 反查 filtered source table。
5. Download：curated table、source evidence table、schema、license、checksum 和 release notes。
6. Help：quick start、search examples、field definitions、curation and ID policy。
7. Statistics：记录数、物种、关系类型、来源、文献和 completeness。
8. Version history：source release、added/revised/deprecated 数量、旧版本下载。
9. About/Cite/Contact：scope、citation、团队、维护、隐私和反馈。

### 可在 v1.1 以后增加

- REST API
- Advanced query builder
- Network visualization
- Batch gene-list search
- User submission form
- Saved searches
- Programmatic schema endpoints

## 首页最重要的信息顺序

1. TripleDB 是什么、与 pairwise interaction resources 的差异。
2. 用户可以输入什么。
3. 当前 release 与 source BioGRID version。
4. Curated records、source evidence、species、publications 等数字。
5. Evidence chain：BioGRID release → filtered evidence → manual aggregation → TDB record。
6. 三个核心入口：Search、Verify evidence、Download。
7. Maintenance/update statement。
