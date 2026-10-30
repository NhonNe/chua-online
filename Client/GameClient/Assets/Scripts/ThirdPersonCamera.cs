using UnityEngine;

namespace ChuaOnline.Gameplay
{

public sealed class ThirdPersonCamera : MonoBehaviour
{
    [SerializeField] private Transform target = null!;
    [SerializeField] private float distance = 7f;
    [SerializeField] private float height = 3.4f;
    [SerializeField] private float sensitivity = 3f;
    [SerializeField] private float smoothing = 12f;
    private float yaw = 25f;
    private float pitch = 18f;

    public void SetTarget(Transform value) => target = value;

    private void LateUpdate()
    {
        if (target == null) return;
        if (Input.GetMouseButton(1))
        {
            yaw += Input.GetAxis("Mouse X") * sensitivity;
            pitch = Mathf.Clamp(pitch - Input.GetAxis("Mouse Y") * sensitivity, 8f, 45f);
        }
        var rotation = Quaternion.Euler(pitch, yaw, 0);
        var focus = target.position + Vector3.up * 1.2f;
        var desired = focus - rotation * Vector3.forward * distance;
        var castDirection = desired - focus;
        if (Physics.SphereCast(focus, .28f, castDirection.normalized, out var hit, castDirection.magnitude, ~0, QueryTriggerInteraction.Ignore))
            desired = focus + castDirection.normalized * Mathf.Max(.7f, hit.distance - .18f);
        transform.position = Vector3.Lerp(transform.position, desired, smoothing * Time.deltaTime);
        transform.LookAt(focus);
    }
}
}
