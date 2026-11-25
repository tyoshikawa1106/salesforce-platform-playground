import { LightningElement, api, wire } from 'lwc';
import { getObjectInfo } from 'lightning/uiObjectInfoApi';

// UI APIにアイコンがない参照先は、その用途に対応するSLDSアイコンで表示する。
const FALLBACK_ICONS = {
    User: 'standard:user', UserRole: 'standard:hierarchy', Group: 'standard:groups',
    ExternalClientApplication: 'standard:connected_apps'
};

// ルックアップの選択先に対応する組織のテーマ画像を表示する。
export default class LookupObjectIcon extends LightningElement {
    // 検索条件などオブジェクト定義のない値は未指定のまま扱う。
    @api objectApiName;
    // 選択欄と候補行で既存のアイコンサイズを引き継ぐ。
    @api size = 'x-small';
    // 隣接するラベルだけでは足りない場合に種別も読み上げる。
    @api alternativeText = '';

    // 読み込めなかった画像は繰り返し要求しない。
    failedUrl;

    // 同じオブジェクトを表示する複数の欄でLightning Data Serviceのキャッシュを共有する。
    @wire(getObjectInfo, { objectApiName: '$objectApiName' }) objectInfo;

    // 切り替え中に前のオブジェクトの画像を表示しない。
    get theme() {
        // 現在の選択と一致した定義だけを使用する。
        return this.objectInfo?.data?.apiName === this.objectApiName ? this.objectInfo?.data?.themeInfo : undefined;
    }

    // テーマ情報がない場合は代替アイコンに切り替える。
    get iconUrl() {
        // Salesforceが返した画像URLを使用する。
        const url = this.theme?.iconUrl;
        // 画像の配信に失敗したときも標準の代替を使う。
        return url !== this.failedUrl ? url : undefined;
    }

    // 画像を取得できなかったときは入力欄に壊れた画像を残さない。
    handleImageError(event) {
        // 失敗した画像のURLだけを代替表示の対象にする。
        this.failedUrl = event.currentTarget.getAttribute('src');
    }

    // テーマの色を白抜きの画像の背景へ適用する。
    get imageStyle() {
        // 色が未定義の場合も画像の輪郭を識別できるようにする。
        return this.theme?.color ? `background-color: #${this.theme.color}` : undefined;
    }

    // 画像と代替アイコンの表示寸法をそろえる。
    get imageClass() {
        // SLDSのアイコン用クラスでサイズと角丸を適用する。
        return `slds-icon slds-icon_container slds-icon-standard-default slds-icon_${this.size}`;
    }

    // 定義未取得・未対応・画像未設定でもルックアップの操作を継続できる。
    get fallbackIcon() {
        // 種別固有の代替がなければレンチのカスタムアイコンを表示する。
        return FALLBACK_ICONS[this.objectApiName] || 'custom:custom19';
    }
}
