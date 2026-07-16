/**
 * ケースメールメッセージ一覧の入力値検証
 */
public with sharing class CaseEmailMessageService {

    // Case 以外のレコードページからの呼び出しを LWC へ通知
    private static final String INVALID_CASE_MESSAGE = 'ケースレコードを確認できませんでした。ページを再読み込みしてください。';

    /**
     * 画面から受け取った ID が Case ID かを検証
     *
     * @param caseId Case レコード ID
     * @return 検証済み Case ID、入力が null の場合は null
     * @throws CaseEmailMessageServiceException Case 以外の ID の場合
     */
    public Id validateCaseId(Id caseId) {
        if (caseId == null) {
            return null;
        }
        Schema.SObjectType objectType = caseId.getSObjectType();
        Boolean isCaseId = objectType == Case.SObjectType;
        if (!isCaseId) {
            throw new CaseEmailMessageServiceException(INVALID_CASE_MESSAGE);
        }
        return caseId;
    }

    /**
     * ケースメールメッセージの入力値例外
     */
    public class CaseEmailMessageServiceException extends Exception {}
}
