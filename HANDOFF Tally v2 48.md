# Tally PWA — 次チャットへの引き継ぎ (現行 v2.51)

> リポジトリでは固定名 `HANDOFF.md` で上書き運用(バージョンはこの見出し、履歴はGit)。

## 0. 現在のフェーズと優先事項
**緊急タスクなし。開発は「データ収集フェーズ」に入った。**機能追加は原則凍結(機能予算: 「月1回以上使うか/入力摩擦を減らすか/意思決定を変えるか」を通らないものは足さない)。

- **分析ダッシュボード(時給・分散・月次トレンド)は閾値到達までビルドしない**: 麻雀30セット/スロット50セッション到達がトリガー。v2.48で実働時刻(startAt/endAt)の記録を開始済みなので、到達時点のデータは時給計算に使える。深夜跨ぎは end<start なら+24hで解釈する規約。
- 投資機能: ユーザーが投資を開始してから(目安: 2027年新年)。器の先行実装は不要とユーザー明言。
- このHANDOFFと RESTORE_RUNBOOK.md はリポジトリに置いてコードと一緒にバージョン管理する方針。
- **作業開始時は必ずユーザーに最新index.htmlをアップロードしてもらうか、リポジトリ(sai2943.github.io/kakeibo)を基準にする。**

## 1. アプリ概要
- **名前**: Tally(旧: 収支台帳)。**単一HTMLファイルのオフラインPWA**(`index.html`+`sw.js`+`manifest.webmanifest`+アイコンpng)。
- **用途**: 収支管理。家計簿+パチスロ+麻雀+(将来)投資。
- **ユーザー**: 清秀/Fujimura Seishu。EV志向のBPO管理職(仙台)。**忌憚のない意見を強く好む**(迎合を嫌う)。iPhone 17 / iOS 26。
- **GitHub**: github.com/sai2943/kakeibo / デプロイ: https://sai2943.github.io/kakeibo/
- **モデル運用**: 2026-07-13からFableは従量課金(usage credits)のためOpus常用。Fableは設計判断・移行・レビュー等の複雑案件のみ。

## 2. デプロイ & 開発フロー(厳守)
- **[DEPLOY]** iOS: Working Copyでファイルを上書き→Commit→Push(ユーザー手動。「いつものpushフローで」と案内すればOK)。更新の反映はアプリをスワイプで閉じて開き直す→更新バー→再読み込み。
- **[DEV] 変更ごとに必ず**:
  1. `str_replace`等で編集
  2. インラインJSを抽出して `node --check`(下記スニペット)
  3. grepで変更箇所検証、可能ならロジックを`node -e`/`python3 -c`でテスト
  4. **バージョンを2箇所バンプ**: コメント `Tally X.XX (localStorage保存・完全オフライン)`(~170行)と `const APP_VERSION = "X.XX"`(~551行)
  5. outputsにコピー→**必ずpresent_filesを呼ぶ**(呼び忘れ厳禁)
- 構文チェック:
```bash
cd /home/claude/pwa && python3 -c "
import re
html=open('index.html',encoding='utf-8').read()
blocks=re.findall(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>',html,re.S)
open('_all.js','w',encoding='utf-8').write('\n;\n'.join(blocks))
" && node --check _all.js && echo SYNTAX_OK && rm -f _all.js
```
- 注意: `uid()`は数値を返すためID比較は`String(x.id)===String(v)`。`saveLocal()`はS全体を直列化(**新フィールドは自動で永続化・同期・エクスポート・スナップショットされる**)。セッション/麻雀の保存は`Object.assign({},draft)`のスプレッド方式なのでドラフトに足せば保存も自動で通る。`save()`=saveLocal+toast+同期スケジュール+updatedAt更新。`num()`=parseInt系、`fnum()`=parseFloat系。

## 3. カラーパレット & デザイン体系(確立済み・変更しない)
```
--bg:#0B1F1E --surface:#12302E --surface2:#1A3E3B --line:#24504C
--amber:#F2B33D --teal:#2DD4BF --red:#E57373 --text:#E8F0EF --muted:#8FAAA7 --blue:#5FA8E8
```
- **色の意味体系**: 緑=プラス/推奨、赤=避けるべき/消費、オレンジ=中間。家計簿カテゴリ(消費=赤枠/娯楽=橙枠/収入=緑枠、枠線のみ)、スロットモード(乗打=橙/代打=緑/単独=赤)、麻雀(セット=橙/フリー=赤)、平均着順の色は基準線(rc+1)/2比較。
- タグ=アウトラインピル統一(10px、副次タグ9px)。カード表示は3画面統一(日付ヘッダー+同日1カード+border-top区切り、一次11px muted/二次11px op.7/金額14px)。人物ピル=personTag()。
- **アプリアイコン=画線法(tally mark)確定済み**: 縦4本白+斜め1本琥珀(右肩上がり)、ダークティールグラデ。apple-touch-icon.png?v=4。遊技タブアイコン=**フラット正面5の目サイコロ**(線画1.7px、他タブと様式統一。旧アイソメ立体は「ピザに見える」問題で廃止)。

## 4. レイアウト構造(重要・壊さないこと)
- タブ: 家計簿(ledger・初期タブ)/遊技(games)/資産(assets)/ツール(tool)。
- **flexbox骨格**: `body{height:100dvh;display:flex;flex-direction:column;overflow:hidden}`、`#app{flex:1;overflow-y:auto}`がスクロール領域、`#navbar`は#appの兄弟でフロー最下段。position:fixedナビは廃止済み。
- **render()は_renderBody()のラッパー**: UI.tab+"/"+UI.screen+"/"+UI.gameSubが前回描画から変わった時だけ#app.scrollTop=0(タブ/画面遷移でスクロール深度が残るiOSバグ対策・v2.44)。同一画面の再描画は位置保持。renderKeepScroll()は明示的に保持したい時用。
- **ナビ下余白は適応式(v2.46)**: `:root`の`--vgap`(JSのupdVgap()が起動/resize時に screen.height−innerHeight を実測代入)と`--navpad: max(2px, calc(env(safe-area-inset-bottom,0px) - var(--vgap) - 12px))`。navbar/FAB/toastが--navpad参照。**-12pxが位置調整の唯一のノブ**。
- **★iOS 26の62pt問題(結論済み・再調査不要)**: スタンドアロンPWAのレイアウトビューポートが物理画面より約62pt短い(実測 inner=812/scr=874/sab=34)。fixed/フローとも62pt持ち上がる。manifest display:fullscreen実験→不発。**OS予約領域でWeb側からは越えられない=iOS修正待ち**。iOSが直れば--navpad機構が自動で適正位置(下端22pt)に降ろす。この件で追加のCSS実験をしないこと。

## 5. データモデル(S, localStorage KEY="kakeibo:v1", Supabase同期)
- `S.entries`: 家計簿 `{id,date,type,category,amount,memo,src,fixedId,store,item}`。src="slot"/"mahjong"=遊技連携(linkId="mj-"+id等), "daida"=代打ち, "fixed"=固定費。
- `S.sessions`: パチスロ `{id,date,store,mode[nori/dai/solo],partnerName,fee,exchange,pExchange,pushPayout,pushDraw,machines[],expenses[],memo,`**`startAt,endAt`**`}`。**startAt/endAt(HH:MM文字列・任意)はv2.48で追加。時給分析用。カード等には表示しない(記録のみ)**。
- `S.mjSessions`: 麻雀 `{id,date,store(ルール名),category[free/set],rule[3/4],score,chips,scoreRate,chipRate,ranks[4],players[](同卓者最大5),baseFee,topBonus,drinkFee,setFee,memo,fromTable,`**`startAt,endAt,expenses[]`**`}`。**expenses[](v2.49)=セット飲食等の私的経費 {id,label,amount}、スロットと同型UI。mjFinal = mjRaw − mjGameFee − mjExpTotal**。
- **共有/私的の境界(v2.49-2.51・壊さないこと)**: スコア表(mjTables)は同卓者に見せる共有ドキュメントなので**金(経費)のUIは置かない**。収支反映は既存生成セッションを削除→再生成する方式だが、**私的フィールド(expenses/memo)はprev[0]から引き継いで生き残らせる**。卓由来の数字(スコア/チップ/ゲーム代/着順)は再生成対象。
- **時刻は表が所有(v2.50-2.51)**: 時刻は同卓者全員が知る共有情報なのでスコア表に実働欄(日付行の直下)を表示・編集可。`t.startAt`=全席の名前が既定文字(A/B/C/D)以外で埋まった瞬間に自動記録(1回のみ)、`t.endAt`=初回の収支反映時に自動記録。**反映のたび sess.startAt/endAt = 表の値をコピー**(表で直せば再反映で記録に伝播)。再反映で終了時刻が現在時刻に更新されることはない(表の既存値を尊重)。深夜跨ぎは end<start なら+24h解釈。
- 計算: machSabai=end−start+hold、machYen=round(差枚/ex*1000)−現金、finalOwn=grossOwn−経費、mjFinal=mjRaw−mjGameFee、mjAvgRank。換金率は**全て1000円基準**(schemaV=3)。
- `S.mdb`(機種), `S.stores`(店舗プリセット), `S.fixed`(固定費), `S.wishlist`, `S.bank`, `S.savings`, `S.budgets`, `S.mjTables`(スコア表), `S.mjPresets`, `S.borderTool`, `S.schemaV:3`, `S.updatedAt`(LWW用・save()でDate.now())。
- **applyDataがスキーマ移行含む唯一の正規復元経路**。インポート(bimport)もスナップ復元もクラウド採用も全てapplyData経由(v2.40でbimportの手動代入バグを修正済み——二度と手動代入に戻さない)。

## 6. バックアップ体制(v2.40-2.47で構築・検証済み)
**三層防御。全て実弾検証済み(訓練復元+実際の端末初期化からのクラウド復旧に成功)。**
1. **ローカル自動スナップショット3世代**: SNAP_KEY=KEY+":snaps"。起動時に日付が変わっていれば「日次」、インポート/スナップ復元前に「復元前」、クラウド採用前に「同期前」。**空データ(entries/sessions/mjSessions/mjTables全て0)は退避しない**(v2.47)。takeSnap()は容量不足時に最新1世代へ縮退。UIは折りたたみ式(UI.snapOpen、既定閉・1行サマリ)。復元は確認ダイアログ+復元前自動退避付き=誤爆しても不可逆損失なし。**アイコン削除=localStorage全消去でスナップも消える(仕様)→クラウドが救う**。
2. **クラウド**: Supabase app_data(1行/ユーザー、LWW、S.updatedAt比較)+**サーバ側履歴 app_data_history(1時間1世代・最新20世代、security definerトリガーtrg_tally_snapshot)**。**RLS有効・全ポリシー auth.uid()=user_id を2026-07-12に実機検証済み**(own_*とtally_own_*が重複しているが無害)。復元手順は RESTORE_RUNBOOK.md(§3のSQLでjsonb_setによりupdatedAtを現在化してLWWで必ず勝たせる)。
3. **手動エクスポートJSON**: 機種変更・iOS大型更新の前のみ。保存先はiCloud Drive「Tally」フォルダ固定を推奨。

- バックアップ画面の並び(使用頻度順・v2.41): クラウド同期→スナップショット→自己診断→エクスポート→インポート→バージョン表記。「アプリの更新」セクションは削除済み(自動チェック: 起動1.5秒後+前面復帰時60秒スロットル、手動: ヘッダー同期ボタン)。
- **自己診断(btest)**: 保存領域R/W、本体件数、計算検証(差枚500/スロ収支-10000/セッション-11500/麻雀2400/**麻雀経費込み2100**/平均着順1.75/スキーマ3——期待値は実関数で検証済みのフィクスチャ)、書出→再取込の件数・金額合計一致、画面計測(inner/client/vv/scr/sab/fixBtm/bodyBtm/dpr)、スナップ世代数。結果は×で閉じられる(msgclose)。診断・スナップ復元はrenderKeepScroll。

## 7. 直近チャットの作業ログ(v2.37→v2.48)
- v2.38 アプリアイコン画線法化(?v=4) / v2.39 遊技タブをフラット5の目に
- v2.40 **復元バグ修正(bimport→applyData化)**、自動スナップショット3世代、自己診断拡張
- v2.41 バックアップ画面を頻度順に再構成、更新セクション削除 / v2.42 診断結果に閉じる×+スクロール保持 / v2.43 スナップ一覧折りたたみ
- v2.44 **タブ/画面遷移のスクロール残留バグ根治**(render()のloc判定)
- v2.45 画面計測を診断に追加 / v2.46 **適応型ナビ余白(--vgap/--navpad)**+manifest fullscreen実験 / v2.47 実験不発確定→manifest standaloneへ復帰+?v=2キャッシュバスト+空スナップ抑止
- v2.48 **セッション実働時刻(startAt/endAt)を両フォームに追加**(時給分析の前提データ収集開始)
- v2.49 **麻雀セッションに私的経費(expenses[])**: スロット同型UI、mjFinalに反映、再反映での私的フィールド消失バグを同時修正
- v2.50 **スコア表の時刻自動記録**: 名前入力完了→startAt、初回反映→endAt(再反映では不変)。nowHM()ヘルパー新設(※todayStrは複数行関数——直後への挿入時はスコープ事故に注意、実際に一度やらかして修正した)
- v2.51 **スコア表に実働欄を表示・編集可に**: 時刻の所有権を表へ移管(反映は常に表の値をコピー)。t.endAtフィールド新設
- Supabase: RLS検証、履歴テーブル+トリガー導入、RESTORE_RUNBOOK.md作成

## 8. 未対応・保留(ユーザー合意済み)
- 時給/分散ダッシュボード・月次トレンド: §0のトリガー到達後。
- 投資機能: 開始後(新年目安)。資産管理→ポートフォリオ評価・投資計画修正の下地となる記録。
- **ホーム画面追加時の名前候補が「台帳」になる問題**: メタ/manifest/titleは全て"Tally"、manifest参照は?v=2でキャッシュバスト済み。次の再追加機会に確認(**再追加はlocalStorage全消去なので名前確認のためだけにやらない**)。それでも出るならiOSのサイト別記憶で制御不能→一度手入力すれば以後記憶される見込み。
- ユーザー却下済み(蒸し返さない): 予算アラート/プッシュ通知、カテゴリ細分化、塗り潰しピル、ローカルスナップ世代数の増加(深い履歴はサーバの役割)、iOS 62ptへの追加CSS実験。

## 9. 現在のバージョンとファイル
**v2.51**。リポジトリ構成: index.html / sw.js(未レビュー・内容未確認) / manifest.webmanifest(display:standalone, name/short_name:Tally) / apple-touch-icon.png / icon-192.png / icon-512.png / HANDOFF.md(本書) / RESTORE_RUNBOOK.md。
sw.jsは一度も精読していないので、更新配信やキャッシュで不可解な挙動が出たらまずsw.jsをアップロードしてもらいレビューすること。
