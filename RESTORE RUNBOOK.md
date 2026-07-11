# Tally 緊急復元ランブック

障害の種類ごとに使う経路が違う。上から順に試す。**この手順書の本体(§3)が必要になるのは③だけ**。

| 状況 | 復旧経路 | 手順 |
|---|---|---|
| ① 誤操作・変なデータになった | ローカル自動スナップショット(3世代) | アプリ内: ツール→データ→バックアップ→自動スナップショット→「戻す」 |
| ② 端末紛失・アイコン削除・iOS初期化 | クラウド現行データ | 新環境でアプリを開きログイン→自動同期で全量復元 |
| ③ ②に加えクラウド現行まで破損 | **サーバ側20世代履歴(本書§3)** | Supabase SQLで履歴から書き戻す |
| ④ Supabaseアカウントごと消失 | 手動エクスポートJSON | アプリ内インポート欄に貼り付けて復元 |
| ⑤ アプリが起動しない(コード破損) | Gitコミット履歴 | Working Copyで前バージョンのindex.htmlに戻してpush。**データは無傷** |

## §1 前提

- サーバ履歴は `app_data_history` テーブルに **1時間1世代・最新20世代** 自動保存されている(保存トリガー `trg_tally_snapshot` 設定済み・2026-07-12確認)
- 操作は supabase.com → 対象プロジェクト → 左メニュー **SQL Editor** で行う
- 分からなくなったらこのファイルごとClaudeに渡して「§3を実行したい」と言えばよい

## §2 履歴の一覧を見る

```sql
select id,
       saved_at,
       jsonb_array_length(data->'entries')    as 記録件数,
       jsonb_array_length(data->'sessions')   as 稼働件数,
       jsonb_array_length(data->'mjSessions') as 麻雀件数
  from app_data_history
 order by saved_at desc;
```

件数と日時を見て、戻したい世代の `id` を控える。

## §3 選んだ世代をクラウド現行に書き戻す

`<ID>` を§2で控えた番号に置き換えて実行(1箇所だけ):

```sql
insert into app_data (user_id, data, updated_at)
select user_id,
       jsonb_set(data, '{updatedAt}',
                 to_jsonb((extract(epoch from now())*1000)::bigint)),
       now()
  from app_data_history
 where id = <ID>
on conflict (user_id) do update
  set data = excluded.data, updated_at = excluded.updated_at;
```

- `jsonb_set` はアプリ内部のタイムスタンプを現在時刻に更新する処理。これにより端末側に古いデータが残っていても、次回同期で**この復元データが必ず勝つ**
- 実行後、アプリでログイン(済みなら「今すぐ同期」)→「クラウドから同期しました」と出れば完了
- 端末側の直前データは同期の直前に「同期前」スナップショットとして自動退避されるので、間違えてもアプリ内から一手で戻せる

## §4 確認

アプリのバックアップ画面で自己診断を実行し、本体データの件数が期待どおりか確認する。

---
最終更新: 2026-07-12 (v2.48時点) / RLS・履歴トリガーの設定検証済み
